import express from 'express'
import { asyncMiddleware } from '../middlewares'
import {uploadDebitTransaction,downloadPicklistRej} from '../controllers/debitTransactionUpload'

const FileUpload=express.Router()

FileUpload.post('/DtFileUpload' , asyncMiddleware(uploadDebitTransaction))//presentation upload
FileUpload.get('/downloadPicklistReject' , asyncMiddleware(downloadPicklistRej))


export { FileUpload }
