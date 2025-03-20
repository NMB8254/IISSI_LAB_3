import { Order, Restaurant } from '../models/models.js'

// TODO: Implement the following function to check if the order belongs to current loggedIn customer (order.userId equals or not to req.user.id)
const checkOrderCustomer = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      attributes: ['userId']
    })
    if (req.user.id === order.userId) {
      return next()
    } else {
      return res.status(403).send('Not enough privileges. This entity does not belong to you')
    }
  } catch (err) {
    return res.status(500).send(err)
  }
}

// TODO: Implement the following function to check if the restaurant of the order exists
const checkRestaurantExists = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: {
        model: Restaurant,
        as: 'restaurant'
      }
    })
    if (order.restaurant) {
      return next()
    } else {
      return res.status(404).send('Restaurant not found')
    }
  } catch (err) {
    return res.status(500).send(err)
  }
}

const checkOrderOwnership = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: {
        model: Restaurant,
        as: 'restaurant'
      }
    })
    if (req.user.id === order.restaurant.userId) {
      return next()
    } else {
      return res.status(403).send('Not enough privileges. This entity does not belong to you')
    }
  } catch (err) {
    return res.status(500).send(err)
  }
}

const checkOrderVisible = (req, res, next) => {
  if (req.user.userType === 'owner') {
    checkOrderOwnership(req, res, next)
  } else if (req.user.userType === 'customer') {
    checkOrderCustomer(req, res, next)
  }
}

const checkOrderIsPending = async (req, res, next) => {
  const order = await Order.findByPk(req.params.orderId, {
    attributes: ['startedAt', 'status']
  })
  if (!order) {
    return res.status(404).send('Order not found')
  }
  if (order.startedAt || order.status !== 'pending') {
    return res.status(409).send('The order cannot be modified because it is not pending.')
  }
  next()
}

const checkOrderCanBeSent = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId)
    const isShippable = order.startedAt && !order.sentAt
    if (isShippable) {
      return next()
    } else {
      return res.status(409).send('The order cannot be sent')
    }
  } catch (err) {
    return res.status(500).send(err.message)
  }
}
const checkOrderCanBeDelivered = async (req, res, next) => {
  const order = await Order.findByPk(req.params.orderId)
  if (!order) {
    return res.status(404).send('Order not found')
  }
  if (!order.sentAt || order.deliveredAt) {
    return res.status(409).send('The order cannot be delivered.')
  }
  next()
}

export { checkOrderOwnership, checkOrderCustomer, checkOrderVisible, checkOrderIsPending, checkOrderCanBeSent, checkOrderCanBeDelivered, checkRestaurantExists }
