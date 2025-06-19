import express from 'express'
import { advanceEmiController } from '../controllers/advanceEmiController'
import { advanceEmiTokenValidator } from '../middlewares'

const AdvanceEmiRouter = express.Router()

AdvanceEmiRouter.use(advanceEmiTokenValidator)

AdvanceEmiRouter.post('/advanceEmi', advanceEmiController)

export default AdvanceEmiRouter