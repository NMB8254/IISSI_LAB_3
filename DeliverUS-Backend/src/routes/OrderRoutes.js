import OrderController from '../controllers/OrderController.js'
import { hasRole, isLoggedIn } from '../middlewares/AuthMiddleware.js'
import { checkEntityExists } from '../middlewares/EntityMiddleware.js'
import * as OrderMiddleware from '../middlewares/OrderMiddleware.js'
import { Order } from '../models/models.js'
import { handleValidation } from '../middlewares/ValidationHandlingMiddleware.js'
import * as OrderValidation from '../controllers/validation/OrderValidation.js'

const loadFileRoutes = function (app) {
  // TODO: Include routes for:
  // 1. Retrieving orders from current logged-in customer
  // 2. Creating a new order (only customers can create new orders)
  console.log('loadFileRoutes called with app: ', app)
  app.route('/orders')
    // 1. Retrieving orders from current logged-in customer
    .get(
      isLoggedIn,
      hasRole('customer'),
      OrderController.indexCustomer)
    // 2. Creating a new order
    .post(
      isLoggedIn,
      hasRole('customer'),
      OrderValidation.create,
      handleValidation,
      OrderController.create)

  app.route('/orders/:orderId/confirm')
    .patch(
      isLoggedIn,
      hasRole('owner'),
      checkEntityExists(Order, 'orderId'),
      OrderMiddleware.checkOrderOwnership,
      OrderValidation.confirm,
      handleValidation,
      OrderController.confirm)

  app.route('/orders/:orderId/send')
    .patch(
      isLoggedIn,
      hasRole('owner'),
      checkEntityExists(Order, 'orderId'),
      OrderMiddleware.checkOrderOwnership,
      OrderValidation.send,
      handleValidation,
      OrderController.send)

  app.route('/orders/:orderId/deliver')
    .patch(
      isLoggedIn,
      hasRole('owner'),
      checkEntityExists(Order, 'orderId'),
      OrderMiddleware.checkOrderOwnership,
      OrderValidation.deliver,
      handleValidation,
      OrderController.deliver)

  // TODO: Include routes for:
  // 3. Editing order (only customers can edit their own orders)
  // 4. Remove order (only customers can remove their own orders)

  app.route('/orders/:orderId')
    .get(
      isLoggedIn,
      checkEntityExists(Order, 'orderId'),
      OrderMiddleware.checkOrderVisible,
      OrderController.show)
    // 3. Editing order
    .put(
      isLoggedIn,
      hasRole('customer'),
      checkEntityExists(Order, 'orderId'),
      OrderMiddleware.checkOrderCustomer,
      OrderValidation.update,
      handleValidation,
      OrderController.update)
    // 4. Remove order
    .delete(
      isLoggedIn,
      hasRole('customer'),
      checkEntityExists(Order, 'orderId'),
      OrderMiddleware.checkOrderCustomer,
      OrderValidation.destroy,
      handleValidation,
      OrderController.destroy)
}

export default loadFileRoutes
