const ENV= process.env.NODE_ENV
const ICIC_CONFIG = require('../config/iciciUPIConfig.json')[ENV]
import moment from "moment";
import { decryption, encryption } from "../utils";
import { countData, fetchAllData, insertService, updateData } from "../utils/crud";
import apicall from "consumeapi/apicall";
import { Op, where,Sequelize } from "sequelize";
import { createBatchID } from "../utils/debitTransactionUploadFile";
import { configureAWS } from '../utils/common/keyCredential.js'
import { downloadDeMergeSourceSystem } from "../controllers/debitTransactionDemergeStatus";
const csv = require('csv-parser');
const { Readable } = require('stream');
import  models  from '../database/index.js'
import { RES_MSG,RES_CODE,ICICI_RESPONSE_STATUS,DATE_FORMAT,UPI_CONSTANT,ERR_MSG,TABLE_NAMES, QUERY_PARAM} from '../constants'
import { ResponseHandler, MastersResponseBody } from '../utils'
import {logger}  from '../modules/filelogger';
import { v4 as uuidv4 } from 'uuid';
const AWS = require('aws-sdk');
const responseHandler = new ResponseHandler()
// import  models  from '../database'
const s3 = new AWS.S3();
const appendToS3File = async ({ bucketName, key, newData }) => {
    try {
      let existingContent = '';
      try {
        const getObjectResponse = await s3.getObject({
          Bucket: bucketName,
          Key: key,
        }).promise();
  
        existingContent = getObjectResponse.Body.toString('utf-8');
      } catch (err) {
        if (err.code !== ERR_MSG.NO_SUCH_KEY) {
          console.log(err);
          return;
        }
      }
      const updatedContent = existingContent + newData;
      await s3.putObject({
        Bucket: bucketName,
        Key: key,
        Body: updatedContent,
        ContentType: "text/plain",
      }).promise();
    } catch (error) {
      console.log('Error appending data to S3 file:', error);
      return;
    }
  };
  

export const updateDemergeColumnToNull = async (sourceSystem, revBatchId,recordBelongsFrom) => {
    try {
        let updateColName = 'demerge_response_FINNONE';
        switch (sourceSystem) {
            case 'BANCS' && recordBelongsFrom === null:
                updateColName = 'demerge_response_BANCS';
                break;
            case 'SAPECC6' && recordBelongsFrom === null:
                updateColName = 'demerge_response_SAPECC6';
                break;
            case 'SAP' && recordBelongsFrom === null:
                updateColName = 'demerge_response_SAP';
                break;
            case 'Manual' && recordBelongsFrom !== null:
                updateColName = 'demerge_response_Manual';
                break;
            default:
                updateColName = 'demerge_response_FINNONE';
                break;
        }
        const update = { [updateColName]: null }; 
        const whereQuery = { reverasl_batch_id : revBatchId,source_system :sourceSystem,mandate_type : 'UPI Mandate'};
        const res = await updateData(update, whereQuery,models['debitTransactionReversalResponse']); 
        return res; 
    } catch (error) {
        console.error('Error updating column to null in demerge UPI Mandate:', error); 
    }
};

const checkMandateRequestId = async (mandateRequestId, presentmentMode, seqNo, upiNotificationRetry, umrn) => {
    let uniqueId;
    let isDuplicate = true;
    let retryCount = parseInt(upiNotificationRetry);

    const generateId = () =>
        presentmentMode === 'Representation' 
            ? `${mandateRequestId}-Rep-NO-${seqNo}-${retryCount}` 
            : `${mandateRequestId}-${seqNo}-${retryCount}`;

    while (isDuplicate) {
        uniqueId = generateId();
        
        const count = await models['debit_tran_reg'].count({
            where: { 
                umrn_no: umrn, 
                upi_merchant_trans_notifiaction_id: uniqueId 
            }
        });
        console.log(count);
        isDuplicate = count !== 0;
        if (isDuplicate) retryCount++;
    }

    return { merchantTranId: uniqueId, retryCount:retryCount };
};

/**
 * 
 * 
 * @param {string} requestId 
 * @returns 
 */
export const notifyUPIUsers = async (requestId)=>{
    try {
        const currentDate = moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss);
        const retry2Hrplus22min = moment().subtract(2, 'hours').add(22,'minutes').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss)
        const retry2Hrminus22min = moment().subtract(2, 'hours').subtract(22,'minutes').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss)

        const whereCondition = {
            mandate_type:UPI_CONSTANT.UPI,
            source_system:UPI_CONSTANT.UPI_SORUCE_SYSTEM,
            tpls_instrument_ref_no: { [Op.ne]: null},
            upi_notification:0,
            upi_process_flag : 0,
            mandate_start: {[Op.gt]:currentDate},
            upi_process_flag :0,
            upi_notification_retry:{ [Op.lt]: Sequelize.literal(`
                CAST(
                    CASE 
                        WHEN presentment_mode = 'Representation' THEN 10 
                        ELSE 20 
                    END AS SIGNED
                )
            `)},
            [Op.or]: [
                {
                  upi_merchant_trans_notification_datetime: {
                    [Op.between]: [retry2Hrminus22min,retry2Hrplus22min]
                  }
                },
                {
                  upi_merchant_trans_notification_datetime: null
                }
              ]
        }
        while(true){
            const pdnData = await countData({ where: whereCondition }, TABLE_NAMES.DEBIT_TRAN_REG);
            if (pdnData === 0) {
                break
            };
            const getUserDataForNotification = await fetchAllData({attributes:['id','company_code','payer_va','mandate_amount','mandate_start','umrn_no','tpls_instrument_ref_no','upi_notification_retry','presentment_mode','emi_seq_no','loan_no'],where:whereCondition,limit:500},models['debit_tran_reg']);
            console.log("------->getUserDataForNotification",getUserDataForNotification.length);
            if(!getUserDataForNotification){
                break
            }
            const idsToUpdate = getUserDataForNotification.map(item => item.id);
            if( idsToUpdate.length > 0 ){
                await updateData({ update : { upi_process_flag : 1 }, whereQuery : {id : {[Op.in]:idsToUpdate}} }, models['debit_tran_reg']);
            }
            const notifyUrl = ICIC_CONFIG.BASE_URL+ICIC_CONFIG.NOTIFICATION_API
            const headers = {apikey:ICIC_CONFIG.CREDENTAIL.API_KEY}
                await Promise.all(getUserDataForNotification.map(async(item)=>{
                const ENNumber = await fetchAllData({ attributes: ['mandate_request_id'], where: { umrn_no: item.umrn_no } }, models[TABLE_NAMES.MANUAL_MANDATE])
                const minTime = moment().add(1, 'days').set({ hour: 11, minute: 0, second: 0 });
                console.log("Mandate Start:", item.mandate_start, "Max Time:", minTime.format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss));
                const dateDiffInHours = moment(minTime).diff(moment(item.mandate_start), 'minutes');
                console.log("------->",dateDiffInHours < 50,dateDiffInHours) ;
                    if(dateDiffInHours > 1440){
                        const update={
                            upi_notification:0,
                            icic_notify_remark: 'Not Eligbal for Notification',
                            upi_notification_retry:parseInt(item.upi_notification_retry)+1,
                            upi_merchant_trans_notification_datetime:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss)
                        }
                        const whereQuery={
                            umrn_no:item.umrn_no,
                            mandate_start:{[Op.like]:item.mandate_start}
                        }
                        await  updateData({update,whereQuery},models[TABLE_NAMES.DEBIT_TRAN_REG])
                    }
                    else{
                        console.log("==========>",item);
                        // const seqNo=parseInt(item.tpls_instrument_ref_no.split('/')[1]) + 1
                        const merchantTranId =[]
                        const result = await checkMandateRequestId(ENNumber[0]['mandate_request_id'],item.presentment_mode,item.emi_seq_no,item.upi_notification_retry,getUserDataForNotification[0].umrn_no);
                        merchantTranId[0] = result.merchantTranId;
                        item.upi_notification_retry = result.retryCount;
                    const params = {
                        "merchantId": ICIC_CONFIG.CREDENTAIL.MERCHANT_ID,
                        "subMerchantId": ICIC_CONFIG.CREDENTAIL.SUB_MERCHANT_ID,
                        "terminalId": ICIC_CONFIG.CREDENTAIL.TERMINAL_ID,
                        "merchantName": ICIC_CONFIG.CREDENTAIL.MERCHANT_NAME,
                        "subMerchantName": ICIC_CONFIG.CREDENTAIL.SUB_MERCHANT_NAME,
                        "payerVa": item.payer_va,
                        "amount": item.mandate_amount,
                        "note": "request",
                        "executionDate": moment(item.mandate_start).format(DATE_FORMAT.DDMMYYYYHHMMA),
                        "merchantTranId": merchantTranId[0],
                        "mandateSeqNo": parseInt(item.emi_seq_no),
                        "key": "UMN",
                        "value": item.umrn_no
                    }
                    console.log("<----------- ICIC APi Call ----------->",notifyUrl,params);
                    try {
                        // const encryptData = await encryption(params,requestId)
                        // const notifyApiCallResponse = await apicall(notifyUrl,encryptData,headers)
                        // const decryptData = await decryption(notifyApiCallResponse)
                        await new Promise(resolve => {setTimeout(() => {console.log("time take");resolve();}, 2000);});                         
                        const decryptData = await dummyResponse(params,'PDN');
                        console.log(decryptData,"PDN Decrpted Dummy Response ==============>");
                        const appendDataToS3 = {bucketName:"systemx-files-uat",key:`UPI_Logs/${item?.loan_no}/${item?.mandate_start}/PDN_Logs`,newData : `\n\n Time : ${moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss)}\n PDN for id : ${merchantTranId[0]} \n Request:${JSON.stringify(params)},\n Response:${JSON.stringify(decryptData)}\n\n`};
                        await appendToS3File(appendDataToS3);
                        if(decryptData.response === UPI_CONSTANT.PDN_SUCCESS_CODE){
                            const update = {
                                upi_notification:1,
                                icic_bank_rrn:decryptData.BankRRN,
                                icic_notify_remark: decryptData.message,
                                mandate_start: moment(item.mandate_start).add(1, 'minutes').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                                upi_merchant_trans_notifiaction_request:JSON.stringify(params),
                                // upi_notification_retry:parseInt(item.upi_notification_retry)+1,
                                upi_merchant_trans_notifiaction_response:decryptData,
                                upi_merchant_trans_notifiaction_id:merchantTranId[0],
                                upi_merchant_trans_notifiaction_bank_rrn:decryptData.BankRRN,
                                upi_merchant_trans_notification_datetime:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                                upi_process_flag : 0,
                            }
                            console.log("---------- Updating in success",update);
    
                            const whereQuery={
                                umrn_no:item.umrn_no,
                                mandate_start:{[Op.like]:item.mandate_start},
                                mandate_type:UPI_CONSTANT.UPI,
                            }
                            await  updateData({update,whereQuery},models[TABLE_NAMES.DEBIT_TRAN_REG])
                        }
                        else {
                            const update = {
                                upi_notification:0,
                                icic_bank_rrn:decryptData.BankRRN,
                                icic_notify_remark: decryptData.message,
                                upi_merchant_trans_notifiaction_request:JSON.stringify(params),
                                upi_merchant_trans_notifiaction_response:JSON.stringify(decryptData),
                                upi_merchant_trans_notifiaction_id:decryptData.merchantTranId,
                                upi_merchant_trans_notifiaction_bank_rrn:decryptData.BankRRN,
                                upi_notification_retry:parseInt(item.upi_notification_retry)+1,
                                upi_merchant_trans_notification_datetime:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                                upi_process_flag : 0,
                            }
                            const whereQuery={
                                umrn_no:item.umrn_no,
                                mandate_start:{[Op.like]:item.mandate_start},
                                mandate_type:UPI_CONSTANT.UPI,
                            }
                        console.log("---------- Updating in fail",update,"--->",whereQuery);
    
                        await  updateData({update,whereQuery},models[TABLE_NAMES.DEBIT_TRAN_REG])
                    }
                    } catch (error) {
                        console.log('Error --->', error);
    
                    } }
                }))
        }
    } catch (error) {
        console.log('Error --->', error);
        throw error
    }
}


/**
 * 
 * @param {string} requestId 
 */
export const executeApiTransection = async(requestId) => {
    try {
        const executeURL = ICIC_CONFIG.BASE_URL+ICIC_CONFIG.EXECUTE_MANDATE_API
        const currentStartDate = moment().startOf('day').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss);
        const currentEndDate = moment().endOf('day').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss);
        const retryHrplus10min = moment().subtract(3, 'hours').add(40,'minutes').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss);
        const retryHrminus10min = moment().subtract(3, 'hours').add(30,'minutes').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss);
        const whereCondition = {
            mandate_type: UPI_CONSTANT.UPI,
            source_system: UPI_CONSTANT.UPI_SORUCE_SYSTEM,
            mandate_start: { [Op.between]: [currentStartDate, currentEndDate] },
            upi_notification: 1,
            upi_process_flag : 0,
            icic_notify_remark: 'Transaction Successful',
            upi_merchant_trans_execution_retry_count: {[Op.lt]:5},
            [Op.or]: [
                {
                  upi_merchant_trans_execution_time: {
                    [Op.between]: [retryHrminus10min,retryHrplus10min]
                  },
                  upi_merchant_trans_execution_status: { [Op.ne]: 'SUCCESS' } 
                },
                {
                  upi_merchant_trans_execution_time: null,
                  upi_merchant_trans_execution_bank_rrn: null 
                }
              ]
          };

        while (true) {
            const exeData = await countData({ where: whereCondition }, 'debit_tran_reg');
            if (exeData === 0) {
                await checkCallbackStatus();
                break
            };
            const getUserDataForExecution = await fetchAllData({where:whereCondition,limit:500},models['debit_tran_reg']);
            if (getUserDataForExecution.length <= 0) { break; }
            const idsToUpdate = getUserDataForExecution.map(item => item.id);
            if(idsToUpdate.length >0){
                await updateData({ update : { upi_process_flag : 1 }, whereQuery : {id : {[Op.in]:idsToUpdate}} }, models['debit_tran_reg']);
            }
            const headers = {apikey:ICIC_CONFIG.CREDENTAIL.API_KEY}
            await Promise.all(getUserDataForExecution.map(async(item)=>{
                const ENNumber= await fetchAllData({attributes:['mandate_request_id'],where:{umrn_no:item.umrn_no}},models[TABLE_NAMES.MANUAL_MANDATE])
                const count = parseInt(item.emi_seq_no) + parseInt(item.upi_retry_count)
                const merchantTranId=[]
                if(item.presentment_mode === QUERY_PARAM.REPRESENTATION){
                    console.log("-------,",item.presentment_mode);
                    merchantTranId[0]=ENNumber[0]['mandate_request_id']+'-EX-Rep-'+parseInt(item.emi_seq_no)+'-'+parseInt(item.upi_merchant_trans_execution_retry_count)
                    
                }
                else{
                    merchantTranId[0]=ENNumber[0]['mandate_request_id']+'-EX-'+parseInt(item.emi_seq_no)+'-'+parseInt(item.upi_merchant_trans_execution_retry_count)
                }
               
    
                const params={
                    "merchantId": ICIC_CONFIG.CREDENTAIL.MERCHANT_ID,
                    "subMerchantId": ICIC_CONFIG.CREDENTAIL.SUB_MERCHANT_ID,
                    "terminalId": ICIC_CONFIG.CREDENTAIL.TERMINAL_ID,
                    "merchantName": ICIC_CONFIG.CREDENTAIL.MERCHANT_NAME,
                    "subMerchantName": ICIC_CONFIG.CREDENTAIL.SUB_MERCHANT_NAME,
                    "amount": item.mandate_amount,
                    "merchantTranId": merchantTranId[0],
                    "billNumber": ENNumber[0]['mandate_request_id']+'-BL-'+ 1,
                    "remark": "EMI Execution",
                    "retryCount": item.upi_retry_count,
                    "mandateSeqNo": parseInt(item.emi_seq_no),
                    "UMN": item.umrn_no,
                    "purpose": "RECURRING"
                    }
    
                    // const encryptData = await encryption(params,requestId)
                    // const exeucteApiResponse = await apicall(executeURL,encryptData,headers)
                    // const decryptData = await decryption(exeucteApiResponse)
                    await new Promise(resolve => {setTimeout(() => {console.log("time take");resolve();}, 2000);});    
                    const decryptData = await dummyResponse(params,'EXE');
                    console.log(decryptData,"Exe Decrpted Dummy Response ==============>");
                    const appendDataToS3 = {bucketName:"systemx-files-uat",key:`UPI_Logs/${item?.loan_no}/${item?.mandate_start}/Exe_Logs`,newData : `\n\n Time : ${moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss)}\n Exe for id : ${merchantTranId[0]} \n Request:${JSON.stringify(params)},\n Response:${JSON.stringify(decryptData)}\n\n`};
                    await appendToS3File(appendDataToS3);
                    if(decryptData.response === UPI_CONSTANT.EXE_SUCCESS_CODE){
                        const update = {
                            upi_merchant_trans_execution_time:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                            upi_merchant_trans_execution_bank_rrn:decryptData.BankRRN,
                            upi_merchant_trans_execution_id: merchantTranId[0],
                            upi_merchant_trans_execution_response:decryptData,
                            upi_merchant_trans_execution_request:JSON.stringify(params),
                            upi_merchant_trans_execution_status:decryptData.success,
                            upi_merchant_trans_execution_remark:decryptData.message,
                            upi_merchant_trans_execution_retry_count: parseInt(item.upi_merchant_trans_execution_retry_count) + 1,
                            merge_flag:1,
                            merge_date_time:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                            settalement_date:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                            merge_user_name:"System",
                            isActiveForMerge:0,
                            upi_exe_callback_flag:0,
                            upi_process_flag : 0,
                        }
                        const whereQuery={
                            umrn_no:item.umrn_no,
                            mandate_start:item.mandate_start,
                        }
                        await  updateData({update,whereQuery},models[TABLE_NAMES.DEBIT_TRAN_REG])
                        if(getUserDataForExecution[0].reverasl_batch_id && item.presentment_mode === QUERY_PARAM.PRESENTATION){
                            await updateDemergeColumnToNull(getUserDataForExecution[0].source_system,getUserDataForExecution[0].reverasl_batch_id,getUserDataForExecution[0].record_belongs_from);
                        }
                        const callbackCall = await dummyResponse(params,'CALLBACK',decryptData.BankRRN);
                        await callbackResponse(requestId,callbackCall);
                        return update
                    }
                    else {
                        console.log("-------- fails ---------------");
                        const update = {
                            upi_merchant_trans_execution_time:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                            upi_merchant_trans_execution_bank_rrn:decryptData.BankRRN,
                            upi_merchant_trans_execution_id: merchantTranId[0],
                            upi_merchant_trans_execution_response:decryptData,
                            upi_merchant_trans_execution_request:JSON.stringify(params),
                            upi_merchant_trans_execution_status:decryptData.success,
                            upi_merchant_trans_execution_remark:decryptData.message,
                            upi_merchant_trans_execution_retry_count: parseInt(item.upi_merchant_trans_execution_retry_count) + 1,
                            merge_flag:1,
                            merge_date_time:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                            merge_user_name:"System",
                            settalement_date:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                            isActiveForMerge:0,
                            upi_exe_callback_flag:0,
                            upi_process_flag : 0,
    
                        }
                        const whereQuery={
                            umrn_no:item.umrn_no,
                            mandate_start:item.mandate_start
                        }
                        await  updateData({update,whereQuery},models[TABLE_NAMES.DEBIT_TRAN_REG])
                        if(getUserDataForExecution[0].reverasl_batch_id && item.presentment_mode === QUERY_PARAM.PRESENTATION){
                            await updateDemergeColumnToNull(getUserDataForExecution[0].source_system,getUserDataForExecution[0].reverasl_batch_id,getUserDataForExecution[0].record_belongs_from);
                        }
                        const callbackCall = await dummyResponse(params,'CALLBACK',decryptData.BankRRN);
                        await callbackResponse(requestId,callbackCall);
                        return update
                    }
            }))
        }
    } catch (error) {
        console.log('Error --->', error);
    }
}

export const executeWithoutPDNApiTransection = async (data) => {
    const requestId = uuidv4();
    try {
        const executeURL = ICIC_CONFIG.BASE_URL + ICIC_CONFIG.EXECUTE_MANDATE_API
        const headers = { apikey: ICIC_CONFIG.CREDENTAIL[data.company_code].API_KEY }
            const ENNumber = await fetchAllData({ attributes: ['mandate_request_id'], where: { umrn_no: data.umrn_no } }, models['manualMandate'])
            // const seqNo = parseInt(item.tpls_instrument_ref_no.split('/')[1]) + 1
            const count = parseInt(data.emi_seq_no) + parseInt(data.upi_merchant_trans_execution_retry_count)
            const merchantTranId = []
            if (data.presentment_mode === QUERY_PARAM.REPRESENTATION) {
                console.log("-------without PDN,", data.presentment_mode);
                merchantTranId[0] = ENNumber[0]['mandate_request_id'] + '-EX-Rep' +'-'+ data.emi_seq_no + '-' + parseInt(data.upi_merchant_trans_execution_retry_count)
            }
            else {
                merchantTranId[0] = ENNumber[0]['mandate_request_id'] + '-EX' +'-'+ data.emi_seq_no + '-' + parseInt(data.upi_merchant_trans_execution_retry_count)
            }
            const params = {
                "merchantId": ICIC_CONFIG.CREDENTAIL.MERCHANT_ID,
                "subMerchantId": ICIC_CONFIG.CREDENTAIL.SUB_MERCHANT_ID,
                "terminalId": ICIC_CONFIG.CREDENTAIL.TERMINAL_ID,
                "merchantName": ICIC_CONFIG.CREDENTAIL.MERCHANT_NAME,
                "subMerchantName": ICIC_CONFIG.CREDENTAIL.SUB_MERCHANT_NAME,
                "amount": data.mandate_amount,
                "merchantTranId": merchantTranId[0],
                "billNumber": ENNumber[0]['mandate_request_id'] + '-BL-' + 1,
                "remark": "EMI Execution",
                "retryCount": 1,
                "mandateSeqNo": parseInt(data.emi_seq_no),
                "UMN": data.umrn_no,
                "purpose": "RECURRING"
            }
            console.log("--------- without PDN>",params);
            // const encryptData = await encryption(params, requestId)
            // const exeucteApiResponse = await apicall(executeURL, encryptData, headers)
            // const decryptData = await decryption(exeucteApiResponse)
            const decryptData = await dummyResponse(params,'EXE');
            console.log(decryptData,"WithoutPDN Exe Decrpted Dummy Response ==============>");
            const appendDataToS3 = {bucketName:"systemx-files-uat",key:`UPI_Logs/${data?.loan_no}/${data?.mandate_start}/Exe_Logs`,newData : `\n\n Time : ${moment().format('YYYY-MM-DD HH:mm:ss')}\n WithoutPDN Exe for id : ${merchantTranId[0]} \n Request:${JSON.stringify(params)},\n Response:${JSON.stringify(decryptData)}\n\n`};
            await appendToS3File(appendDataToS3);
            if (decryptData.response === "92") {
                const update = {
                    upi_merchant_trans_execution_time: moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                    upi_merchant_trans_execution_bank_rrn: decryptData.BankRRN,
                    upi_merchant_trans_execution_id: merchantTranId[0],
                    upi_merchant_trans_execution_response: decryptData,
                    upi_merchant_trans_execution_request:JSON.stringify(params),
                    upi_merchant_trans_execution_status: decryptData.success,
                    upi_merchant_trans_execution_remark: decryptData.message,
                    upi_merchant_trans_execution_retry_count: parseInt(data.upi_merchant_trans_execution_retry_count),
                    merge_flag: 1,
                    merge_date_time: moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                    settalement_date: moment().format("YYYY-MM-DD"),
                    merge_user_name: "System",
                    isActiveForMerge: 0,
                }
                
                return {status:true,data:update};
            }
            else {
                console.log("-------- fails ---------------");
                const update = {
                    upi_merchant_trans_execution_time: moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                    upi_merchant_trans_execution_bank_rrn: decryptData.BankRRN,
                    upi_merchant_trans_execution_id: merchantTranId[0],
                    upi_merchant_trans_execution_response: decryptData,
                    upi_merchant_trans_execution_request:JSON.stringify(params),
                    upi_merchant_trans_execution_status: decryptData.success,
                    upi_merchant_trans_execution_remark: decryptData.message,
                    upi_merchant_trans_execution_retry_count: parseInt(data.upi_merchant_trans_execution_retry_count),
                    merge_flag: 1,
                    merge_date_time: moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                    merge_user_name: "System",
                    settalement_date: moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
                    isActiveForMerge: 0,

                }
                
                return {status:false,data:update};
            }
    } catch (error) {
        console.log('Error --- in without PDN icic api call execution --------------------->', error);
    }
}


/**
 * 
 * @param {*} requestId 
 * @param {*} mandateTransID 
 * @returns 
 */
export const upiTransectionStatus = async (requestId,mandateTransID) => {
    try{
        const statusURL = ICIC_CONFIG.BASE_URL+ICIC_CONFIG.TRANSACTION_STATUS_API
        const headers = {apikey:ICIC_CONFIG.CREDENTAIL.API_KEY}
        const params={
        "merchantId": ICIC_CONFIG.CREDENTAIL.MERCHANT_ID,
        "subMerchantId": ICIC_CONFIG.CREDENTAIL.SUB_MERCHANT_ID,
        "terminalId": ICIC_CONFIG.CREDENTAIL.TERMINAL_ID,
        "merchantTranId": mandateTransID
        }
        const encryptData = await encryption(params,requestId)
        const notifyApiCallResponse = await apicall(statusURL,encryptData,headers)
        const decryptData = await decryption(notifyApiCallResponse)
        console.log("-----------------------> decryptData status api",decryptData);
        return decryptData

    }catch(error){
        console.log(error);
        throw error
    }
}


export const callbackResponse = async (requestId,data,res) => {
    try {
        console.log("-----------------------> data in callback",data);
        const currentDate = moment().subtract(3,'days').format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss);
        const whereCon ={
            upi_merchant_trans_execution_bank_rrn :data.BankRRN,
            upi_merchant_trans_execution_id :{[Op.like]:data.merchantTranId+'%'},
            upi_merchant_trans_execution_time:{[Op.gt]:currentDate},
        }
        const findDemergeData = await fetchAllData(
                {
                attributes:[
                    'mandate_start',
                    'batch_id',
                    'reverasl_batch_id',
                    'bank_code',
                    'mandate_type',
                    'company_code',
                    'presentment_mode',
                    'source_system',
                    'loan_no'
                ],
                where:whereCon
            },models["debit_tran_reg"])
            console.log("---------------->",findDemergeData);
        const total_count = await countData({where:{batch_id:findDemergeData[0].batch_id}},TABLE_NAMES.DEBIT_TRAN_REG)
            console.log("---------> total count", total_count);
        if(!findDemergeData[0].reverasl_batch_id){
            console.log("-------------> creating demerge id");
            const body= {
                user_name: "System",
                file_name: "-",
                upload_status: "Success",   
                total_count: total_count,
                succuss_count: 0,
                rejected_count: 0,
                pending_count: 0,
                bank_code: findDemergeData[0].bank_code,
                mandate_type:findDemergeData[0].mandate_type,
                company_code: findDemergeData[0].company_code,
                presentation_type: findDemergeData[0].presentment_mode,
                upload_date_time:
                moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss) || "",
            }
            const demergeCreate = await insertService(body,TABLE_NAMES.DEBIT_TRAN_REVERSAL_RES)
            const update={batch_id:demergeCreate.id}
            const whereQuery={id:demergeCreate.id}
            await updateData({update,whereQuery},models[TABLE_NAMES.DEBIT_TRAN_REVERSAL_RES])
            // const updateValue = 
            const params={
                update:{reverasl_batch_id: demergeCreate.id},
                whereQuery:{
                mandate_type:UPI_CONSTANT.UPI,
                source_system:UPI_CONSTANT.UPI_SORUCE_SYSTEM,
                merge_flag:1,
                merge_user_name:"System",
                batch_id:findDemergeData[0].batch_id
            }}
            // const weherCon= 
            console.log("-------------- updating value,",weherCon,updateValue);
            await updateData(params,models[TABLE_NAMES.DEBIT_TRAN_REG])
        }
        const resCode1 = data.RespCodeDescription.split('|'); 
        let dtRejectCode = null;

        if (resCode1.length > 1) {
            // Try to find in the database using the second value (resCode1[1])
            dtRejectCode = await fetchAllData({
                where: {
                    mandate_type: UPI_CONSTANT.UPI,
                    sourse_system: UPI_SORUCE_SYSTEM,
                    rejection_code: resCode1[1] // Use the second value from RespCodeDescription
                }
            }, models[TABLE_NAMES.DEBIT_TRAN_REVERSAL_RES]);
        }
        
        // If no result is found, fallback to ResponseCode
        if (!dtRejectCode || dtRejectCode.length === 0) {
            dtRejectCode = await fetchAllData({
                where: {
                    mandate_type: UPI_CONSTANT.UPI,
                    sourse_system: UPI_CONSTANT.UPI_SORUCE_SYSTEM,
                    rejection_code: data.ResponseCode // Use ResponseCode as a fallback
                }
            }, models[TABLE_NAMES.DEBIT_TRAN_REVERSAL_RES]);
        }
        const param={update:{
            upi_merchant_trans_execution_status: data.TxnStatus,
            demerge_file_name:'-', 
            demerge_date_time:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
            response_status: dtRejectCode[0].rejection_code,
            response_rejection_reason: data.RespCodeDescription,
            umrn_no:data.UMN,
            reversal_current_date:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss),
            demerge_flag:'1' ,
            demerge_user_name:"System",
            response_rejection_reason:ICICI_RESPONSE_STATUS[data.RespCodeDescription] === 67 ? "100" : "004",
        },whereQuery:{
            upi_merchant_trans_execution_bank_rrn:data.BankRRN,
            mandate_start:moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss) , 
            merge_flag:'1'
        }}
        await updateData(param,models[TABLE_NAMES.DEBIT_TRAN_REG])
        const appendDataToS3 = {bucketName:"systemx-files-uat",key:`UPI_Logs/${findDemergeData[0]?.loan_no}/${findDemergeData[0]?.mandate_start}/Callback_Logs`,newData : `\n\n Time : ${moment().format(DATE_FORMAT.YYYY_MM_DD_HH_mm_ss)}\n Callback for id : ${data?.merchantTranId} \n  Callback Data:${JSON.stringify(data)}\n\n`};
        await appendToS3File(appendDataToS3);
        return true

        
    } catch (error) {
        console.log('error', error);
    }
}

export const readFilesfromS3 = async (bucket, s3Key) => {
    try {
        const s3 = await configureAWS();

        // Using async/await for S3 getObject
        const data = await s3.getObject({ Bucket: bucket, Key: s3Key }).promise();

        return data.Body.toString("utf-8");
    } catch (error) {
        console.error('Error while reading file from S3:', error);
        throw error;
    }
};



export const processCsvData = async (bucket, res, s3Key, logId) => {
    let responseSent = false; // Flag to track if the response has been sent

    try {
        const expectedHeaders = [
            'mandate_type',
            'company_code',
            'source_system',
            'loan_no',
            'mandate_date',
            'mandate_amount'
        ];
        // Read CSV data from S3
        const csvData = await readFilesfromS3(bucket, s3Key);
        const jsonData = [];

        // Parse CSV data
        await new Promise((resolve, reject) => {
            Readable.from(csvData)
                .pipe(csv())
                .on('headers', (headers) => {
                    // Check if headers match the expected headers
                    const headersMatch = expectedHeaders.every(header => headers.includes(header));
                    if (!headersMatch) {
                        if (!responseSent) {
                          responseHandler.MasterHandleBody(
                                new MastersResponseBody(RES_CODE[400], RES_MSG.INVALID_FILE),
                                res
                            );
                            
                            models.file_execution_logs.update(
                                {
                                    file_status: 'Invalid file',
                                },
                                {
                                    where: {
                                        id: logId
                                    }
                                }
                            );
                            responseSent = true;
                        }   
     
                    }
                })
                .on('data', (row) => jsonData.push(row))
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        if (responseSent) return; // Ensure we don't proceed if response was already sent

        console.log('CSV file successfully processed');

        // Total records count
        const totalRecords = jsonData.length;
        if (totalRecords > 0) {
            if (!responseSent) {
                responseHandler.MasterHandleBody(
                    new MastersResponseBody(RES_CODE.SUCCESS, RES_MSG.FILE_IS_PROCESSED),
                    res
                );
                responseSent = true;
            }
        } else {
            if (!responseSent) {
                responseHandler.MasterHandleBody(
                    new MastersResponseBody(RES_CODE[400], RES_MSG.NO_DATA_FOUND),
                    res
                );
                models.file_execution_logs.update(
                    {
                        file_status: 'No data found',
                    },
                    {
                        where: {
                            id: logId
                        }
                    }
                );
                responseSent = true;
            }
        }

        const batchSize = 100;
        let batchStartIndex = 0;
        let successCount = 0;
        let failedCount = 0;

        while (batchStartIndex < totalRecords) {
            const batchRecords = jsonData.slice(batchStartIndex, batchStartIndex + batchSize);
            batchStartIndex += batchSize;
            // Process each record in the current batch
           const uploadUser= await models.file_execution_logs.findOne(
                {
                    where: {
                        id: logId
                    },raw:true
                }
            );

            for (const record of batchRecords) {
                console.log("::::::::::::::::::::::record", record);
                if (record.mandate_type === 'UPI Mandate' &&
                    record.loan_no &&
                    record.mandate_date &&
                    record.mandate_amount) {

                    const mandateStartDate = `${moment(record.mandate_date, 'DD/MM/YYYY').format('YYYY-MM-DD')} %`;
                    console.log(">>>>>>>>>>>>>>", mandateStartDate);
                    
                    // Check if record exists based on multiple conditions
                    const existingRecord = await models.debit_tran_reg.findOne({
                        where: {
                            mandate_type: record.mandate_type,
                            mandate_start: {[Op.between]:[moment(mandateStartDate).startOf('day'),moment(mandateStartDate).endOf('day')]},
                            // [Op.and]: [
                            //     Sequelize.where(
                            //         Sequelize.fn('DATE_FORMAT', Sequelize.col('mandate_start'), '%Y-%m-%d'),
                            //         mandateStartDate
                            //     )
                            // ],
                            loan_no: record.loan_no,
                            mandate_amount: parseFloat(record.mandate_amount).toFixed(2),
                            response_status :  { [Op.ne]: '00'}
                        },  
                        raw:true,
                        logging:true
                    });
                   console.log(":::>>>>>>>>>>>>>existingRecord ", existingRecord);
                    if (existingRecord) {
                        // Update existing record
                        console.log("inside if");
                        const [updateCount] = await models.debit_tran_reg.update(
                            {
                                response_status: 'success',
                                upi_merchant_trans_execution_status: 'SUCCESS',
                                upi_merchant_trans_execution_remark: 'Success',
                                upi_merchant_trans_execution_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                                upi_merchant_trans_execution_response: 'manual Payment',
                                upi_merchant_trans_execution_id: 'manual Payment',
                                response_status:"00",
                                response_rejection_reason:'APPROVED OR COMPLETED SUCCESSFULLY',
                                upi_merchant_trans_execution_bank_rrn: 'manual Payment',
                                excl_file_uploaded_by:uploadUser.uploaded_by,
                                excl_file_flag:1
                            },
                            {
                                where: {
                                    mandate_type: record.mandate_type,
                                    mandate_start: {[Op.between]:[moment(mandateStartDate).startOf('day'),moment(mandateStartDate).endOf('day')]},
                                    loan_no: record.loan_no,
                                    mandate_amount: parseFloat(record.mandate_amount).toFixed(2)
                                }
                            }
                        );
                        console.log("-------------> updateCount",updateCount);
                        if (updateCount > 0) {
                            successCount++;
                        } else {
                            failedCount++;
                        }
                    } else {
                        failedCount++;
                    }
                }
            }
        }

        // Update the log table with the counts
        await models.file_execution_logs.update(
            {
                file_status: 'Success',
                total_records: totalRecords,
                success_records: successCount,
                failed_records: failedCount
            },
            {
                where: {
                    id: logId
                }
            }
        );

        // Ensure response is sent only once
        if (!responseSent) {
            responseHandler.MasterHandleBody(
                new MastersResponseBody(RES_CODE.SUCCESS, RES_MSG.ACKNOWLEDGED),
                res
            );
        }

        return { totalRecords, successCount, failedCount };
    } catch (error) {
        console.error('Error in processCsvData:', error);
        // Ensure response is sent only once
        if (!responseSent) {
            responseHandler.MasterHandleBody(
                new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR),
                res
            );
        }
        throw error; // Rethrow to be caught in the controller
    }
};

const dummyResponse = async (params, type, bankrrn) => {
    const choose = Math.floor(Math.random() * 2);
    const currentDateTime = moment().format(DATE_FORMAT.YYYYMMDDHHmmss);
    const generatedBankRrn = Math.floor(100000000000 + Math.random() * 900000000000);
    let checkForDuplicateID = false;

    const userData = await fetchAllData({
        where: { umrn_no: type === 'PDN'?params?.value : params?.UMN },
        attributes: ['upi_merchant_trans_notifiaction_id', 'upi_merchant_trans_execution_id', 'payer_va', 'customer_name'],
        order: [['id', 'ASC']],
    }, models['debit_tran_reg']);
    
    const generateResponse = (message, success, responseCode) => ({
        response: responseCode || (choose === 0 ? "0" : "XB"),
        merchantId: params?.merchantId,
        subMerchantId: params?.subMerchantId,
        terminalId: params?.terminalId,
        success: success || (choose === 0 ? "true" : "false"),
        message: message || (choose === 0 ? "Transaction Successful" : "XB|INVALID TRANSACTION OR IF MEMBER IS NOT ABLE TO FIND ANY APPROPRIATE RESPONSE CODE (REMITTER)"),
        merchantTranId: params?.merchantTranId,
        BankRRN: generatedBankRrn,
    });

    if (type === 'PDN') {
        return generateResponse("Transaction Successful", "true");
    } else if (type === 'EXE') {
        return generateResponse("Transaction initiated", "true", "92");
    } else if (type === 'CALLBACK') {
        return {
            subMerchantId: params?.subMerchantId,
            ResponseCode: choose === 0 ? "U30" : "00",
            RespCodeDescription: choose === 0 ? "DEBIT HAS BEEN FAILED|Z9|INSUFFICIENT FUNDS IN CUSTOMER (REMITTER) ACCOUNT" : "APPROVED OR COMPLETED SUCCESSFULLY",
            PayerMobile: "0000000000",
            TxnCompletionDate: currentDateTime,
            terminalId: params?.terminalId,
            PayerName: "Mr Ashish Khan",
            PayeeVPA: "TataCapital2@icici",
            PayerAmount: "4430.00",
            PayerVA: params?.UMN,
            BankRRN: bankrrn,
            merchantId: params?.merchantId,
            PayerAccountType: "SAVINGS",
            UMN: params?.UMN,
            TxnInitDate: currentDateTime,
            TxnStatus: choose === 0 ? "EXECUTE-FAILURE" : "SUCCESS",
            merchantTranId: params?.merchantTranId,
        };
    }
};
