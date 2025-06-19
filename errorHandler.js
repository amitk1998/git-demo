import { ERR_MSG, HTTP_STATUS } from '../constants'
const { logger } = require('../modules/filelogger')

export const errorHandler = (err, req, res, next) => {
  logger.error(err)

  if (err.constructor.name === 'ResponseBody') {
    const code = parseInt(err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR)
    return res.status(code).json({
      code,
      message: err.message,
      errors: err.data
    })
  }
  // Handle Apperror
  if (err.name === 'Apperror') {
    const code = parseInt(err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR)
    return res.status(code).json({
      code,
      message: err.message,
      errors: err.data
    })
  }

  // IF ERROR IS RELATED TO Sequelize, THROW SOMETHING_WENT_WRONG & RECORD THE ERROR IN DB
  if (err.name === 'SequelizeDatabaseError') {
    const code = parseInt(err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR)
    return res.status(code).json({
      code,
      message: ERR_MSG.SOMETHING_WENT_WRONG
    })
  }

  // Handle Mongoose  validation error
  if (err.name === 'ValidationError') {
    const code = parseInt(HTTP_STATUS.BAD_REQUEST)
    return res.status(code).json({
      code,
      message: 'Validation Error',
      errors: err?.details
    })
  }

  // Default handle error
  const errormessage = ['local', 'dev', 'uat'].includes(process.env.NODE_ENV)
    ? err.message
    : 'Service is down. Please try again later'

  if (!res.headersSent) {
    const code = parseInt(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    return res.status(code).json({
      code,
      message: errormessage
    })
  }
}
