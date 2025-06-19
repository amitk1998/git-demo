import { RES_MSG, RES_CODE, FILE_FORMAT, QUERY_PARAM, MODULE_NAME, FUNCTION_NAME, LOGGER_CODES, S3_FILE_PATH } from '../constants'
import { ResponseHandler, MastersResponseBody } from '../utils'
import { billUploadFile, rptUploadFile, downloadRptReject, downloadRptSuccess, setRejectionFlag, setApproveFlag, otuUploadFile } from '../services/RptUploadFileStatus'
import { logger } from '../modules/filelogger'
const responseHandler = new ResponseHandler()
const jsonexport = require('jsonexport'), XLSX = require('xlsx')
import axios from "axios";
import { getDownloadPresignUrl, getUploadPresignUrl } from '../utils/common/commonRequestMethod'
import moment from 'moment-timezone'
import { v4 as uuidv4 } from 'uuid'
const moduleName = MODULE_NAME.DT;
const subModuleName = MODULE_NAME.RPT;
let functionName = '';
const timestamp = moment().toISOString();

// APPROVE MERGE FLAG FUNCTIONALITY
export const approveRptMergeFlag = async (req, res) => {
  let requestId = uuidv4();
  try {
    const { batch_id } = req.query;

    functionName = FUNCTION_NAME.APPROVE_FLAG;
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Approve Merge Flag Request Body : ${JSON.stringify(req.query)} | ${functionName} | ${LOGGER_CODES.INFO}`);
    let approveRptMergeFlag = await setApproveFlag(batch_id);
    if (!approveRptMergeFlag) {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Approve Merge Flag Error : ${JSON.stringify(RES_MSG.BAD_REQUEST)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE[400], RES_MSG.BAD_REQUEST, {}),
        res
      )
    }
    if (approveRptMergeFlag === true) {
      logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Approve Merge Flag Response Body : ${JSON.stringify(QUERY_PARAM.BATCH_IS_APPROVED)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE.SUCCESS, QUERY_PARAM.BATCH_IS_APPROVED, {}),
        res
      )
    } else {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Approve Merge Flag Error : ${JSON.stringify(QUERY_PARAM.BATCH_IS_ALREADY_REJECTED)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE[404], QUERY_PARAM.BATCH_IS_ALREADY_REJECTED, {}),
        res
      )
    }
  } catch (error) {
    logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Approve Merge Flag Error : ${JSON.stringify(error)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
    return responseHandler.MasterHandleBody(new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
  }
}
//REJECT RPT MERGE FLAG FUNCTIONALITY
export const rejectRptMergeFlag = async (req, res) => {
  let requestId = uuidv4();
  try {
    const { batch_id } = req.query;

    functionName = FUNCTION_NAME.REJECT_FLAG;
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Reject Merge Flag Request Body : ${JSON.stringify(req.query)} | ${functionName} | ${LOGGER_CODES.INFO}`);
    let rejectRptMergeFlag = await setRejectionFlag(batch_id);
    if (!rejectRptMergeFlag) {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Reject Merge Flag Error : ${JSON.stringify(RES_MSG.BAD_REQUEST)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE.BAD_REQUEST, RES_MSG.BAD_REQUEST, {}),
        res
      )
    }
    if (rejectRptMergeFlag === true) {
      logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Reject Merge Flag Request Body : ${JSON.stringify(QUERY_PARAM.BATCH_IS_REJECTED)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE.SUCCESS, QUERY_PARAM.BATCH_IS_REJECTED, {}),
        res
      )
    } else {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Reject Merge Flag Error : ${JSON.stringify(QUERY_PARAM.BATCH_IS_ALREADY_APPROVED)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE[404], QUERY_PARAM.BATCH_IS_ALREADY_APPROVED, {}),
        res
      )
    }
  } catch (error) {
    logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Reject Merge Flag Error : ${JSON.stringify(error)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
    return responseHandler.MasterHandleBody(new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
  }
}

//DOWNLOAD RPT SUCCESS DATA
export const downloadRptSucc = async (req, res) => {
  let requestId = uuidv4();
  try {
    const { batch_id } = req.query;

    functionName = FUNCTION_NAME.DOWNLOAD_RPT_SUCCESS;
    const currentDate = moment().format('YYYY_MM_DD')
    const [year, month, day] = currentDate.split('_');
    const key = `${year}/${month}/${day}/${S3_FILE_PATH.DT}/${S3_FILE_PATH.DOWNLOADS}/${S3_FILE_PATH.RPT_PROVISION_UPLOAD}/${S3_FILE_PATH.SUCCESS}/${batch_id}/statusDownloads${batch_id}.xlsx`
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Success Request Body : ${JSON.stringify(req.query)} | ${functionName} | ${LOGGER_CODES.INFO}`);
    let downloadDeMergeSuccessFile = await downloadRptSuccess(batch_id);
    if (!downloadDeMergeSuccessFile) {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Success Error : ${JSON.stringify(RES_MSG.BAD_REQUEST)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE.BAD_REQUEST, RES_MSG.BAD_REQUEST, {}),
        res
      )
    }
    if (downloadDeMergeSuccessFile.length != 0) {
      const presignedS3Urldata = await getUploadPresignUrl(key)
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(downloadDeMergeSuccessFile);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      await axios({
        method: 'put',
        url: presignedS3Urldata?.data,
        data: xlsxBuffer,
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      const downloadPresignedS3Url = await getDownloadPresignUrl(key);
      logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Success Reponse Body : ${JSON.stringify(downloadPresignedS3Url?.data)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(
          RES_CODE.SUCCESS,
          RES_MSG.ACKNOWLEDGED,
          downloadPresignedS3Url.data
        ),
        res
      )
    }
    else {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Success Error : ${JSON.stringify(RES_MSG.NO_DATA_FOUND)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE[400], RES_MSG.NO_DATA_FOUND, downloadDeMergeSuccessFile ? downloadDeMergeSuccessFile : '', {}),
        res
      )
    }
  } catch (error) {
    logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Success Error : ${JSON.stringify(RES_MSG.INTERNAL_SERVER_ERROR)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
    return responseHandler.MasterHandleBody(new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
  }
}
//DOWNLOAD RPT REJECT DATA
export const downloadRptRej = async (req, res) => {
  let requestId = uuidv4();
  try {
    const { batch_id } = req.query;

    functionName = FUNCTION_NAME.DOWNLOAD_RPT_REJECT;
    const currentDate = moment().format('YYYY_MM_DD')
    const [year, month, day] = currentDate.split('_');
    const key = `${year}/${month}/${day}/${S3_FILE_PATH.DT}/${S3_FILE_PATH.DOWNLOADS}/${S3_FILE_PATH.RPT_PROVISION_UPLOAD}/${S3_FILE_PATH.REJECT}/${batch_id}/statusDownloads${batch_id}.xlsx`
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Reject Request Body : ${JSON.stringify(req.query)} | ${functionName} | ${LOGGER_CODES.INFO}`);
    let downloadDeMergeRejectFile = await downloadRptReject(batch_id);
    if (!downloadDeMergeRejectFile) {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Reject Error : ${JSON.stringify(RES_MSG.BAD_REQUEST)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE.BAD_REQUEST, RES_MSG.BAD_REQUEST, {}),
        res
      )
    }
    if (downloadDeMergeRejectFile.length != 0) {
      const presignedS3Urldata = await getUploadPresignUrl(key);
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(downloadDeMergeRejectFile);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      await axios({
        method: 'put',
        url: presignedS3Urldata?.data,
        data: xlsxBuffer,
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      const downloadPresignedS3Url = await getDownloadPresignUrl(key);
      logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Reject Request Body : ${JSON.stringify(downloadPresignedS3Url.data)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE.SUCCESS, RES_MSG.ACKNOWLEDGED, downloadPresignedS3Url.data),
        res
      )
    }
    else {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Reject Error : ${JSON.stringify(RES_MSG.NO_DATA_FOUND)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE[400], RES_MSG.NO_DATA_FOUND, {}),
        res
      )
    }
  } catch (error) {
    logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Download Rpt Reject Error : ${JSON.stringify(RES_MSG.INTERNAL_SERVER_ERROR)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
    return responseHandler.MasterHandleBody(new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
  }
}


// RPT FILE UPLOAD
export const rptFileUpload = async (req, res) => {
  let requestId = uuidv4();
  try {
    const { body } = req;

    functionName = FUNCTION_NAME.RPT_FILE_UPLOAD;
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Rpt File Upload Request Body : ${JSON.stringify(body)} | ${functionName} | ${LOGGER_CODES.INFO}`);
    let rptUpload = await rptUploadFile(body);
    if (!rptUpload) {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Rpt File Upload Error : ${JSON.stringify(RES_MSG.BAD_REQUEST)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE[400], RES_MSG.BAD_REQUEST, {}),
        res
      )
    }
    if (rptUpload.status === 200) {
      logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Rpt File Upload Response Body : ${JSON.stringify(rptUpload)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE.SUCCESS, RES_MSG.ACKNOWLEDGED, rptUpload ? rptUpload : '', {}),
        res
      )
    }
    else {
      logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Rpt File Upload Error : ${JSON.stringify(rptUpload)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
      return responseHandler.MasterHandleBody(
        new MastersResponseBody(RES_CODE[400], RES_MSG.NO_DATA_FOUND, {}),
        res
      )
    }
  } catch (error) {
    logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Rpt File Upload Error : ${JSON.stringify(error)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
    return responseHandler.MasterHandleBody(new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
  }
}

//BIll Upload
export const billUpload = async (req, res) => {
  let requestId = uuidv4();
  try {
    const { body } = req;

    functionName = FUNCTION_NAME.BILL_UPLOAD;
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Bill  Upload Request Body : ${JSON.stringify(body)} | ${functionName} | ${LOGGER_CODES.INFO}`);
    // billUploadFile(body);
    // logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Bill Upload Response Body : ${JSON.stringify(RES_MSG.FILE_IS_PROCESSED)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
   // Run billUploadFile asynchronously after response is sent
    setImmediate(() => {
      billUploadFile(body);
      logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Bill Upload Response Body : ${JSON.stringify(RES_MSG.FILE_IS_PROCESSED)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
    });
    return responseHandler.MasterHandleBody(
      new MastersResponseBody(RES_CODE.SUCCESS, RES_MSG.FILE_IS_PROCESSED, {}),
      res
    )
  } catch (error) {
    logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Bill Upload Error : ${JSON.stringify(error)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
    return responseHandler.MasterHandleBody(new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
  }
}

export const rptOtuUploader = (req, res) => {
  let requestId = uuidv4();
  try {
    const { body } = req;

    functionName = FUNCTION_NAME.OTU;
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | RPT OTU  Upload Request Body : ${JSON.stringify(body)} | ${functionName} | ${LOGGER_CODES.INFO}`);
    otuUploadFile(body);
    logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | RPT OTU Upload Response Body : ${JSON.stringify(RES_MSG.FILE_IS_PROCESSED)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
    return responseHandler.MasterHandleBody(
      new MastersResponseBody(RES_CODE.SUCCESS, RES_MSG.FILE_IS_PROCESSED, {}),
      res
    )
  } catch (error) {
    logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | RPT OTU Upload Error : ${JSON.stringify(error)} | ${functionName} | ${LOGGER_CODES.ERROR}`);
    return responseHandler.MasterHandleBody(new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
  }
}
