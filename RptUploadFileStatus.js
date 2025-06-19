import { Op } from 'sequelize';
import { DATE_FORMAT, QUERY_PARAM } from '../constants';
import models from '../database'
import moment from 'moment-timezone'
import { processRepresentationBillUploadFile, setRejectFlag, checkIsActiveForMerge, updateStatus, storeRejectedFileRecord, storeFileRecord, updateRejectedStatus, createAndFetchBatchId, processRepresentationFile, updateActiveFlagOfStatusTbl, setIsActiveForMergeFlag, checkIsRejectedForMerge, setInActiveForMergeFlag, convertDataIntoJson, getFormattedData, hdfcNachAndLegDemerge, updateDemergeLogs, processPresentationBillUploadFile } from '../utils/rptFileUpload/index'
let excelToJson = require('convert-excel-to-json');
import { fetchAllData } from '../utils/crud'
import { logger } from '../modules/filelogger'
import { readFilesfromS3, readFilesfromS3_For_xlsx_json } from '../utils/copyFilesFromS3/index'
const XLSX = require('xlsx');

const bucketName = process.env.BUCKET_NAME

//DOWNLOAD REJECTED RPT DATA 
export const downloadRptReject = async (batch_id) => {
  try {
    let queryResults = await fetchAllData({
      attributes: [QUERY_PARAM.BATCH_ID, QUERY_PARAM.MANDATE_TYPE, QUERY_PARAM.BANK_CODE, QUERY_PARAM.SOURCE_SYSTEM1, QUERY_PARAM.LOAN_NO, QUERY_PARAM.CUSTOMER_NAME, QUERY_PARAM.ACCOUNT_NUMBER, QUERY_PARAM.MANDATE_START, QUERY_PARAM.MANDATE_AMOUNT, QUERY_PARAM.UPLOAD_STATUS, QUERY_PARAM.RESPONSE_REJECTION_REASON, QUERY_PARAM.UPLOAD_REJECT_REASON, QUERY_PARAM.PRESENTATION_REMARK, QUERY_PARAM.PRESENTATION_MODE],
      where: {
        batch_id: {
          [Op.like]: [batch_id]
        }
      },

    }, models["debit_tran_res"])
    let downloadData = [];
    for (const result of queryResults) {
      downloadData.push({
        'Batch Id': result.batch_id,
        'Mandate Type': result.mandate_type,
        'Bank Code': result.bank_code,
        'Source System': result.source_system,
        'Loan No': result.loan_no,
        'Customer Name': result.customer_name,
        'Debit Date': moment(result.mandate_start).format(DATE_FORMAT.DD_MM_YYYY),
        'Amount': result.mandate_amount,
        'Status': "Reject",
        'Reason': result.upload_reject_reason !== null ? result.upload_reject_reason : "Duplicate entry"
      });
    }
    return downloadData;
  } catch (ex) {
    logger.error("download Rpt Reject", ex);
    throw ex;
  }
}

//DOWNLOAD SUCCESSFULL RPT DATA
export const downloadRptSuccess = async (batch_id) => {
  try {
    let queryResults = await models.debit_tran_reg.findAll({
      attributes: [QUERY_PARAM.BATCH_ID, QUERY_PARAM.MANDATE_TYPE, QUERY_PARAM.BANK_CODE, QUERY_PARAM.SOURCE_SYSTEM1, QUERY_PARAM.LOAN_NO, QUERY_PARAM.CUSTOMER_NAME, QUERY_PARAM.ACCOUNT_NUMBER, QUERY_PARAM.MANDATE_START, QUERY_PARAM.MANDATE_AMOUNT, QUERY_PARAM.UPLOAD_STATUS, QUERY_PARAM.RESPONSE_REJECTION_REASON, QUERY_PARAM.UPLOAD_REJECT_REASON, QUERY_PARAM.PRESENTATION_REMARK, QUERY_PARAM.PRESENTATION_MODE],
      where: {
        batch_id: {
          [Op.eq]: [batch_id]
        }
      },
      raw: true
    });
    let downloadDataSuccess = [];
    for (const queryResult of queryResults) {
      const index = queryResults.indexOf(queryResult) + 1;

      downloadDataSuccess.push({
        'No': index,
        'Batch Id': queryResult.batch_id,
        'Mandate Type': queryResult.mandate_type,
        'Bank Code': queryResult.bank_code,
        'Source System': queryResult.source_system,
        'Loan No': queryResult.loan_no,
        'Customer Name': queryResult.customer_name,
        // 'Account Number': queryResult.presentment_mode !== QUERY_PARAM.REPRESENTATION ? queryResult.account_number : QUERY_PARAM.NULL,
        'Debit Date': moment(queryResult.mandate_start).format(DATE_FORMAT.DD_MM_YYYY),
        'Amount': queryResult.mandate_amount,
        'Status': "Success"
      });
    }

    return downloadDataSuccess;
  } catch (ex) {
    logger.error("download Rpt Success", ex);
    throw ex;
  }
}

//APPROVE MERGE FLAG FUNCTION
export const setApproveFlag = async (batchId) => {
  try {
    const isReject = await checkIsRejectedForMerge(batchId);

    const batchCanApprove = isReject === true ? false : await setIsActiveForMergeFlag(batchId);

    const response = batchCanApprove === true ? await updateActiveFlagOfStatusTbl(batchId) : false;
    return response;
  } catch (err) {
    logger.error("set Approve Flag", err);
    throw err;
  }
}

//REJECT MERGE FLAG FUNCTION
export const setRejectionFlag = async (batchId) => {
  try {
    const isActive = await checkIsActiveForMerge(batchId);

    const batchCanReject = isActive === true ? false : await setInActiveForMergeFlag(batchId);

    const response = batchCanReject === true ? await setRejectFlag(batchId) : false;
    return response;
  } catch (err) {
    logger.error("set Reject Flag", err);
    throw err;
  }
}

//RPT UPLOAD FUNCTIONALITY
export const rptUploadFile = async (param) => {
  try {
    let userName = param.userName;
    let fileName = param.file_name;
    let key = param.key;
    let batchId = param.batchId;
    let fileExtension = fileName.split('.').pop();
    let params = { fileName, userName, fileExtension, key, batchId };

    const s3Params = {
      bucket: process.env.BUCKET_NAME,
      key: param.key,
    }
    const file = await readFilesfromS3(s3Params);
    let fileData = file.toString('utf-8').split('\n');
    const fileProcessing = fileExtension === 'csv' ? await processRepresentationFile(params, fileData) : null;
    let response
    if (fileProcessing === null) {
      response = { status: 403, message: 'Wrong File Extension' };
    } else if (fileProcessing.status === 200) {
      response = { status: 200, message: fileProcessing.message };
    } else {
      response = { status: 200 };
    }
    return response;
  }
  catch (err) {
    logger.error(`Error in uploadFile:: ${err}`);
    throw err;
  }
}

//BILL UPLOAD FUNCTIONALITY   
export const billUploadFile = async (param) => {
  try {
    let {withoutPDNExe,mandate_type, company_code, presentation_type, userName, roleData, key, file_name: fileName, batchId,mandate_date } = param;

    const s3Params = {
      bucket: process.env.BUCKET_NAME,
      key,
    }
    const file = await readFilesfromS3(s3Params);
    let fileData = file.toString('utf-8').split('\n');

    if (presentation_type === 'Presentation') {
      let fileExtension = fileName.substring(fileName.length - 6).split('.')[1];
      if (fileExtension === 'xlsx') {
        if(company_code === 'Manual'){
          try {
            const fileData  = await readFilesfromS3_For_xlsx_json(s3Params);
            const res = await processPresentationBillUploadFile(param,fileData);
            return res;
          } catch (error) {
            console.log("Eorror in Bill Upload Presentation" ,error);
          }
        }
        const result = excelToJson({
          sourceFile: `download/${fileName}`,
          sheets: false,
          header: {
            rows: 1
          }
        });
        let file_data = result[Object.keys(result)[0]];   
        let params = { fileName, userName, company_code, batchId }
        let jsonData = file_data;
        let total_records = jsonData.length;
        params.total_records = total_records;
        // const batchId = await createAndFetchBatchId(params);
        // params.batchId = batchId;

        const formattedData = await convertDataIntoJson(file_data, params);

        if (formattedData.status === false) {
          await updateRejectedStatus(params, formattedData.success_array);
          return ({ status: 400 });
        } else {
          const status = await storeFileRecord(formattedData.success_array);
          const rejectedStatus = await storeRejectedFileRecord(formattedData.reject_array);

          params.failureCount = status.data.failureCount;
          params.failureCountData = rejectedStatus.data.failureCount;
          await updateStatus(params);
          return ({ status: 200 });
        }
      } else {
        let response = { status: 403, message: 'Wrong File Extension' };
        return response;
      }
    } else if (presentation_type === 'Representation') {
      let { company_code, presentation_type } = param;
      let params = { withoutPDNExe,mandate_date,mandate_type,company_code, presentation_type, file_name: fileName, user_name: userName, upload_date_time: new Date().toLocaleString(), upload_status: 'Processing', user_role: roleData, batchId };
      let fileExtension = fileName.split('.').pop();
      let subString = fileName.substring(4, 10);
      let isDate = moment(subString, 'DDMMYY', true).isValid();
      if (isDate) {
        const fileProcessing = fileExtension === 'csv' ? await processRepresentationBillUploadFile(params, fileData) : null;
        let response
        if (fileProcessing === null) {
          response = { status: 403, message: 'Wrong File Extension' };
        } else if (fileProcessing.status === 200) {
          response = { status: 200, message: fileProcessing.message };
        } else {
          response = { status: 200 };
        }
        return response;
      } else {
        let response
        if (fileExtension !== 'xlsx') {
          response = { status: 403, message: 'Wrong File Extension' };
        } else {
          response = { status: 403, message: 'Wrong File Name' };
        }
        return response;
      }
    }
  }
  catch (err) {
    logger.error(`Error in uploadFile:: ${err}`);
    throw err;
  }
}

export const otuUploadFile = async (params) => {
  try {
    const { key, filename, id } = params;

    const s3Params = {
      bucket: process.env.BUCKET_NAME,
      key,
    }
    const result = await readFilesfromS3_For_xlsx_json(s3Params);
    const data = result.shift();
    const formattedJson = await getFormattedData(result, params);
    const hdfcNachAndLegDemergeRes = await hdfcNachAndLegDemerge(formattedJson);
    const updateLogs = await updateDemergeLogs({ ...params, ...hdfcNachAndLegDemergeRes }, 'Representation');
  } catch (error) {
    logger.error(`Error in uploadFile:: ${error}`);
    throw error;
  }
}