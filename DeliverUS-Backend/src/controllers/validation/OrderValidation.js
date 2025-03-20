import { check } from 'express-validator'
import { Product, Order, Restaurant } from '../../models/models.js'

// [Create]
async function checkRestaurantExists (value, { req }) {
  // Check that restaurantId is present in the body and corresponds to an existing restaurant
  try {
    const restaurant = await Restaurant.findByPk(req.body.restaurantId)
    if (restaurant === null) {
      return Promise.reject(new Error('The restaurantId does not exist.'))
    } else { return Promise.resolve() }
  } catch (err) {
    return Promise.reject(new Error(err))
  }
}

// [Create & Update]
const checkProductIdQuantityGreaterThanZero = (value, { req }) => {
  // Check that products is a composed of objects with productId and quantity greater than 0
  for (const producto of req.body.products) {
    if (producto.productId <= 0 || producto.quantity <= 0) {
      return false
    }
  }
  return true
}

// [Create & Update]
const checkProductsAvailable = async (value, { req }) => {
  // Checks that an order producs exists
  try {
    if (req.body.products === undefined) {
      return Promise.reject(new Error('Order has no products'))
    }

    for (const productItem of req.body.products) {
      const productReq = await Product.findByPk(productItem.productId)
      if (productReq == null) {
        return Promise.reject(new Error('The productId does not exist.'))
      } else {
        // if it's not available, return false
        if (productReq.availability === false) {
          return Promise.reject(new Error('The product is not available.'))
        }
      }
    }

    return Promise.resolve()
  } catch (err) {
    console.log(err)
    return Promise.reject(new Error(err))
  }
}

// [Create]
const checkOrderAllProductsFromSameRestaurant = async (value, { req }) => {
  // Checks that all products from an order belongs to the same restaurant
  try {
    if (req.body.products === undefined) {
      return Promise.reject(new Error('Order has no products'))
    }

    const restaurante = req.body.restaurantId
    for (const productItem of req.body.products) {
      const productReq = await Product.findByPk(productItem.productId)
      if (restaurante !== productReq.restaurantId) {
        return Promise.reject(new Error('The productId does not exist.'))
      }
    }
    return Promise.resolve()
  } catch (err) {
    return Promise.reject(new Error(err))
  }
}

// [Update]
const checkProductsFromOriginalRestaurant = async (value, { req }) => {
  // Check that all the products belong to the same restaurant of the originally saved order that is being edited.
  try {
    if (req.body.products === undefined) {
      return Promise.reject(new Error('Order has no products'))
    }

    const orderConRId = await Order.findByPk(req.params.orderId, {
      attributes: ['restaurantId']
    })

    if (orderConRId == null) {
      return Promise.reject(new Error('The order does not exist'))
    }

    for (const productItem of req.body.products) {
      const productReq = await Product.findByPk(productItem.productId, {
        attributes: ['restaurantId']
      })

      if (productReq == null) {
        return Promise.reject(new Error('The product does not exist.'))
      } else {
        const restIdDelProducto = productReq.restaurantId
        if (orderConRId.restaurantId !== restIdDelProducto) {
          return Promise.reject(new Error('There are products from different restaurants'))
        }
      }
    }

    return Promise.resolve()
  } catch (err) {
    return Promise.reject(new Error('Error checking product restaurant match with order'))
  }
}

const checkOrderPending = async (value, { req }) => {
  try {
    const order = await Order.findByPk(req.params.orderId,
      {
        attributes: ['startedAt', 'status']
      })
    if (order.startedAt || order.status !== 'pending') {
      return Promise.reject(new Error('The order has already been started'))
    } else {
      return Promise.resolve('ok')
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

const checkOrderCanBeSent = async (value, { req }) => {
  try {
    const order = await Order.findByPk(req.params.orderId,
      {
        attributes: ['startedAt', 'sentAt']
      })
    if (!order.startedAt) {
      return Promise.reject(new Error('The order is not started'))
    } else if (order.sentAt) {
      return Promise.reject(new Error('The order has already been sent'))
    } else {
      return Promise.resolve('ok')
    }
  } catch (err) {
    return Promise.reject(err)
  }
}
const checkOrderCanBeDelivered = async (value, { req }) => {
  try {
    const order = await Order.findByPk(req.params.orderId,
      {
        attributes: ['startedAt', 'sentAt', 'deliveredAt']
      })
    if (!order.startedAt) {
      return Promise.reject(new Error('The order is not started'))
    } else if (!order.sentAt) {
      return Promise.reject(new Error('The order is not sent'))
    } else if (order.deliveredAt) {
      return Promise.reject(new Error('The order has already been delivered'))
    } else {
      return Promise.resolve('ok')
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

// TODO: Include validation rules for create that should:
// 1. Check that restaurantId is present in the body and corresponds to an existing restaurant
// 2. Check that products is a non-empty array composed of objects with productId and quantity greater than 0
// 3. Check that products are available
// 4. Check that all the products belong to the same restaurant
const create = [
  check('address').exists(),
  check('restaurantId').exists().isInt({ min: 1 }).toInt().custom(checkRestaurantExists),
  check('products').exists().isArray().isLength({ min: 1 })
    .custom(checkProductIdQuantityGreaterThanZero)
    .custom(checkProductsAvailable)
    .custom(checkOrderAllProductsFromSameRestaurant)
]
// TODO: Include validation rules for update that should:
// 1. Check that restaurantId is NOT present in the body.
// 2. Check that products is a non-empty array composed of objects with productId and quantity greater than 0
// 3. Check that products are available
// 4. Check that all the products belong to the same restaurant of the originally saved order that is being edited.
// 5. Check that the order is in the 'pending' state.
const update = [
  check('restaurantId').isEmpty(),
  check('products')
    .exists()
    .isArray().isLength({ min: 1 })
    .custom(checkProductIdQuantityGreaterThanZero)
    .custom(checkProductsAvailable)
    .custom(checkProductsFromOriginalRestaurant),
  check().custom(checkOrderPending)
]

const destroy = [
  check('status').custom(checkOrderPending)
]

const confirm = [
  check('startedAt').custom(checkOrderPending)
]

const send = [
  check('sentAt').custom(checkOrderCanBeSent)
]

const deliver = [
  check('deliveredAt').custom(checkOrderCanBeDelivered)
]

export { create, update, destroy, confirm, send, deliver }
