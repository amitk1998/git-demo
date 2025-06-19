import express from 'express'
import { asyncMiddleware } from '../middlewares'
import { deMergeSourceSystem, downloadDeMergeSourceSystem, downloadDeMergeRejectFile, downloadDeMergeSuccessFile, fetchManualCount, downloadManualSourceSystem, mandateRegistrationDemerge, downloadDeMergeRegistrationRej } from '../controllers/debitTransactionDemergeStatus'

const DebitTransactionDeMergeStatus = express.Router()

DebitTransactionDeMergeStatus.get('/downloadDeMergeSuccessFile', asyncMiddleware(downloadDeMergeSuccessFile))
DebitTransactionDeMergeStatus.get('/downloadDeMergeRejectFile', asyncMiddleware(downloadDeMergeRejectFile))
DebitTransactionDeMergeStatus.get('/deMergeSourceSystem', asyncMiddleware(deMergeSourceSystem))
DebitTransactionDeMergeStatus.get('/downloadDeMergeSourceSystem', asyncMiddleware(downloadDeMergeSourceSystem))
DebitTransactionDeMergeStatus.get('/fetchManualCount', asyncMiddleware(fetchManualCount))
DebitTransactionDeMergeStatus.post('/downloadManualSourceSystem', asyncMiddleware(downloadManualSourceSystem))
DebitTransactionDeMergeStatus.post('/mandateRegistrationDemerge', asyncMiddleware(mandateRegistrationDemerge))
DebitTransactionDeMergeStatus.get('/downloadphysicalDemergeRej', asyncMiddleware(downloadDeMergeRegistrationRej))

export { DebitTransactionDeMergeStatus }
