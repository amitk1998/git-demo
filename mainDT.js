const responseHandler = new ResponseHandler()  
const MainDT = express.Router()
import express from 'express'
import {DebitTransactionMergeStatus} from './debitTransactionMergeStatus'
import {DebitTransactionDeMergeStatus} from './debitTransactionDemergeStatus'
import {RptFileUploadStatus} from './rptFileUploadStatus'
import {FileUpload} from './fileUpload'
import { tokenValidation } from '../middlewares'
import { ResponseHandler,MastersResponseBody } from '../utils'
import { HTTP_STATUS, RES_MSG } from '../constants'
import { upiRouter } from './upiRouter'
import AdvanceEmiRouter from './advanceEmi'

MainDT.get('/health-check', (request, response, next) => {
    return responseHandler.MasterHandleBody( new MastersResponseBody(HTTP_STATUS.OK, RES_MSG.OK,{}),
        response)
  })
MainDT.use('/UPI',upiRouter)
// MainDT.use(tokenValidation)
MainDT.use('/Merge', DebitTransactionMergeStatus)
MainDT.use('/DeMerge', DebitTransactionDeMergeStatus)
MainDT.use('/Rpt',RptFileUploadStatus)
MainDT.use('/DtUpload',FileUpload)
MainDT.use('/Emi', AdvanceEmiRouter)


export { MainDT }
