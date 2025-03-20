// eslint-disable-next-line no-unused-vars
import { Order, Product, Restaurant, User, sequelizeSession } from '../models/models.js'
import moment from 'moment'
import { Op } from 'sequelize'
const generateFilterWhereClauses = function (req) {
  const filterWhereClauses = []
  if (req.query.status) {
    switch (req.query.status) {
      case 'pending':
        filterWhereClauses.push({
          startedAt: null
        })
        break
      case 'in process':
        filterWhereClauses.push({
          [Op.and]: [
            {
              startedAt: {
                [Op.ne]: null
              }
            },
            { sentAt: null },
            { deliveredAt: null }
          ]
        })
        break
      case 'sent':
        filterWhereClauses.push({
          [Op.and]: [
            {
              sentAt: {
                [Op.ne]: null
              }
            },
            { deliveredAt: null }
          ]
        })
        break
      case 'delivered':
        filterWhereClauses.push({
          sentAt: {
            [Op.ne]: null
          }
        })
        break
    }
  }
  if (req.query.from) {
    const date = moment(req.query.from, 'YYYY-MM-DD', true)
    filterWhereClauses.push({
      createdAt: {
        [Op.gte]: date
      }
    })
  }
  if (req.query.to) {
    const date = moment(req.query.to, 'YYYY-MM-DD', true)
    filterWhereClauses.push({
      createdAt: {
        [Op.lte]: date.add(1, 'days') // FIXME: se pasa al siguiente día a las 00:00
      }
    })
  }
  return filterWhereClauses
}

// Returns :restaurantId orders
const indexRestaurant = async function (req, res) {
  const whereClauses = generateFilterWhereClauses(req)
  whereClauses.push({
    restaurantId: req.params.restaurantId
  })
  try {
    const orders = await Order.findAll({
      where: whereClauses,
      include: {
        model: Product,
        as: 'products'
      }
    })
    res.json(orders)
  } catch (err) {
    res.status(500).send(err)
  }
}

// TODO: Implement the indexCustomer function that queries orders from current logged-in customer and send them back.
// Orders have to include products that belongs to each order and restaurant details
// sort them by createdAt date, desc.
const indexCustomer = async function (req, res) {
  const whereClauses = generateFilterWhereClauses(req)
  whereClauses.push({
    userId: req.user.id
  })
  try {
    const orders = await Order.findAll({
      where: whereClauses,
      include: [{
        model: Product,
        as: 'products'
      }, {
        model: Restaurant,
        as: 'restaurant'
      }],
      order: [['createdAt', 'DESC']]
    })
    res.json(orders)
  } catch (err) {
    res.status(500).send(err)
  }
}

// TODO: Implement the create function that receives a new order and stores it in the database.
// Take into account that:
// 1. If price is greater than 10€, shipping costs have to be 0.
// 2. If price is less or equals to 10€, shipping costs have to be restaurant default shipping costs and have to be added to the order total price
// 3. In order to save the order and related products, start a transaction, store the order, store each product linea and commit the transaction
// 4. If an exception is raised, catch it and rollback the transaction

const create = async (req, res) => {
  const t = await sequelizeSession.transaction()
  try {
    const newOrder = Order.build(req.body)
    newOrder.createdAt = Date.now()
    newOrder.startedAt = null
    newOrder.sentAt = null
    newOrder.deliveredAt = null
    newOrder.userId = req.user.id // cliente autenticado

    let precioTotalDelPedido = 0.0
    for (const lineaProducto of req.body.products) {
      const esteProducto = await Product.findByPk(lineaProducto.productId, {
        atributes: ['price'],
        transaction: t
      })
      precioTotalDelPedido += lineaProducto.quantity * esteProducto.price
    }

    if (precioTotalDelPedido > 10) {
      newOrder.shippingCosts = 0.0
    } else {
      const esteRestaurante = await Restaurant.findByPk(req.body.restaurantId, {
        transaction: t
      })
      newOrder.shippingCosts = esteRestaurante.shippingCosts
    }
    newOrder.price = precioTotalDelPedido + newOrder.shippingCosts

    const order = await newOrder.save({ transaction: t })
    for (const lineaProducto of req.body.products) {
      const miProducto = await Product.findByPk(lineaProducto.productId, { transaction: t })
      await order.addProduct(miProducto, { through: { quantity: lineaProducto.quantity, unityPrice: miProducto.price }, transaction: t })
    }

    const toReturn = await Order.findOne(
      {
        where: { id: order.id },
        include: {
          model: Product,
          as: 'products'
        },
        transaction: t
      })

    await t.commit()
    res.json(toReturn)
  } catch (err) {
    await t.rollback()
    res.status(500).send(err)
  }
}

// TODO: Implement the update function that receives a modified order and persists it in the database.
// Take into account that:
// 1. If price is greater than 10€, shipping costs have to be 0.
// 2. If price is less or equals to 10€, shipping costs have to be restaurant default shipping costs and have to be added to the order total price
// 3. In order to save the updated order and updated products, start a transaction, update the order, remove the old related OrderProducts and store the new product lines, and commit the transaction
// 4. If an exception is raised, catch it and rollback the transaction
const update = async function (req, res) {
  const t = await sequelizeSession.transaction()
  try {
    const pedidoOriginal = await Order.findByPk(req.params.orderId)

    const updatedData = {
      address: req.body.address
    }

    // Calculo precio del pedido => cantidad producto * precio producto
    let precioTotalDelPedido = 0.0
    for (const lineaProducto of req.body.products) {
      const esteProducto = await Product.findByPk(lineaProducto.productId, {
        atributes: ['price'],
        transaction: t
      })
      precioTotalDelPedido += lineaProducto.quantity * esteProducto.price
    }

    // Calculo gastos de envio
    if (precioTotalDelPedido > 10) {
      updatedData.shippingCosts = 0.0
    } else {
      const esteRestaurante = await Restaurant.findByPk(pedidoOriginal.restaurantId, {
        transaction: t
      })
      updatedData.shippingCosts = esteRestaurante.shippingCosts
    }

    // Precio = precio productos + gastos de envio
    updatedData.price = precioTotalDelPedido + updatedData.shippingCosts

    // Actualizamos
    await Order.update(updatedData, { where: { id: req.params.orderId }, transaction: t })
    const updatedOrder = await Order.findByPk(req.params.orderId, { transaction: t })

    // Para eliminar los productos que hubiese antes
    await updatedOrder.setProducts([], { transaction: t })

    for (const product of req.body.products) {
      const miProducto = await Product.findByPk(product.productId, { transaction: t })
      await updatedOrder.addProduct(miProducto, { through: { quantity: product.quantity, unityPrice: miProducto.price }, transaction: t })
    }

    const toReturn = await Order.findOne(
      {
        where: { id: updatedOrder.id },
        include: {
          model: Product,
          as: 'products'
        },
        transaction: t
      })

    await t.commit()
    res.json(toReturn)
  } catch (err) {
    await t.rollback()
    res.status(500).send(err)
  }
}

// TODO: Implement the destroy function that receives an orderId as path param and removes the associated order from the database.
// Take into account that:
// 1. The migration include the "ON DELETE CASCADE" directive so OrderProducts related to this order will be automatically removed.
const destroy = async function (req, res) {
  try {
    const result = await Order.destroy({ where: { id: req.params.orderId } })
    let message = ''
    if (result === 1) {
      message = 'Sucessfuly deleted order id.' + req.params.orderId
    } else {
      message = 'Could not delete order.'
    }
    res.json(message)
  } catch (err) {
    res.status(500).send(err)
  }
}

const confirm = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId)
    if (!order) {
      return res.status(404).send('Order not found')
    }
    if (order.startedAt) {
      return res.status(409).send('The order is not in a pending state')
    }
    order.startedAt = new Date()
    const updatedOrder = await order.save()
    res.json(updatedOrder)
  } catch (err) {
    res.status(500).send(err.message)
  }
}

const send = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId)
    if (!order) {
      return res.status(404).send('Order not found')
    }
    if (!order.startedAt || order.sentAt) {
      return res.status(409).send('The order cannot be sent')
    }
    order.sentAt = new Date()
    const updatedOrder = await order.save()
    res.json(updatedOrder)
  } catch (err) {
    res.status(500).send(err.message)
  }
}

const deliver = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId)
    if (!order) {
      return res.status(404).send({ error: 'Order not found' })
    }
    if (!order.sentAt) {
      return res.status(409).send({ error: 'The order has not been sent yet and cannot be delivered.' })
    }
    if (order.deliveredAt) {
      return res.status(409).send({ error: 'The order has already been delivered.' })
    }
    order.deliveredAt = new Date()
    await order.save()
    res.status(200).json(order)
  } catch (err) {
    res.status(500).send({ error: err.message })
  }
}

const show = async function (req, res) {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: [{ model: Product, as: 'products' }]
    })
    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }
    res.status(200).json(order)
  } catch (err) {
    res.status(500).send(err.message)
  }
}

const analytics = async function (req, res) {
  const yesterdayZeroHours = moment().subtract(1, 'days').set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  const todayZeroHours = moment().set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  try {
    const numYesterdayOrders = await Order.count({
      where:
      {
        createdAt: {
          [Op.lt]: todayZeroHours,
          [Op.gte]: yesterdayZeroHours
        },
        restaurantId: req.params.restaurantId
      }
    })
    const numPendingOrders = await Order.count({
      where:
      {
        startedAt: null,
        restaurantId: req.params.restaurantId
      }
    })
    const numDeliveredTodayOrders = await Order.count({
      where:
      {
        deliveredAt: { [Op.gte]: todayZeroHours },
        restaurantId: req.params.restaurantId
      }
    })

    const invoicedToday = await Order.sum(
      'price',
      {
        where:
        {
          createdAt: { [Op.gte]: todayZeroHours }, // FIXME: Created or confirmed?
          restaurantId: req.params.restaurantId
        }
      })
    res.json({
      restaurantId: req.params.restaurantId,
      numYesterdayOrders,
      numPendingOrders,
      numDeliveredTodayOrders,
      invoicedToday
    })
  } catch (err) {
    res.status(500).send(err)
  }
}

const OrderController = {
  indexRestaurant,
  indexCustomer,
  create,
  update,
  destroy,
  confirm,
  send,
  deliver,
  show,
  analytics
}
export default OrderController
