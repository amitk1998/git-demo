import express from 'express'
import { asyncMiddleware } from '../middlewares'
import {downloadFiveField,downloadMergeData,mergeData} from '../controllers/debitTransactionMergeStatus'

const DebitTransactionMergeStatus = express.Router()

DebitTransactionMergeStatus.get('/downloadFiveField' , asyncMiddleware(downloadFiveField))
DebitTransactionMergeStatus.get('/downloadMergeData' , asyncMiddleware(downloadMergeData))
DebitTransactionMergeStatus.post('/DtMerge' , asyncMiddleware(mergeData))



export { DebitTransactionMergeStatus }
