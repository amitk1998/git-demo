import express from 'express'
import { asyncMiddleware } from '../middlewares'
import { rejectRptMergeFlag, approveRptMergeFlag, downloadRptSucc, downloadRptRej, rptFileUpload, billUpload, rptOtuUploader } from '../controllers/rptUploadFileStatus'

const RptFileUploadStatus = express.Router()

RptFileUploadStatus.get('/approveMergeFlag', asyncMiddleware(approveRptMergeFlag))
RptFileUploadStatus.get('/rejectMergeFlag', asyncMiddleware(rejectRptMergeFlag))
RptFileUploadStatus.get('/downloadRptSuccess', asyncMiddleware(downloadRptSucc))
RptFileUploadStatus.get('/downloadRptReject', asyncMiddleware(downloadRptRej))
RptFileUploadStatus.post('/rptFileUpload', asyncMiddleware(rptFileUpload))
RptFileUploadStatus.post('/billUpload', asyncMiddleware(billUpload))
RptFileUploadStatus.post('/rptotu', asyncMiddleware(rptOtuUploader))


export { RptFileUploadStatus }
