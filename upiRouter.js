import express from 'express'
import { asyncMiddleware } from '../middlewares'
import { upiCallback, upiExecuteTransection, upiNotifyUser, upiStatusTransection,processCsvFromS3 } from '../controllers/upiController'
const upiRouter = express.Router()

upiRouter.get('/notify',asyncMiddleware(upiNotifyUser))
upiRouter.get('/exe',asyncMiddleware(upiExecuteTransection))
upiRouter.get('/upi-status',asyncMiddleware(upiStatusTransection))
upiRouter.post('/callback',asyncMiddleware(upiCallback))
upiRouter.post('/processCsvFromS3',asyncMiddleware(processCsvFromS3))



export {upiRouter}