import { FILE_FORMAT, QUERY_PARAM,DATE_FORMAT } from '../constants';
import {debitUploadLambda,debitUploadLocalProcess} from '../utils/debitTransactionUpload/index'
import {Op } from 'sequelize';
import  models  from '../database'
import moment from 'moment-timezone'
import {fetchAllData} from '../utils/crud'
import {logger}  from '../modules/filelogger'

    // DT UPLOAD FUNCTIONALITY LOCAL AND LAMBDA
    export const uploadDebitTransactionFile = async(params) =>{
        try{
            const FileName = params.fileName;
            if ((params.source_system == QUERY_PARAM.FINNONE && params.extension == QUERY_PARAM.csv) || (params.source_system == QUERY_PARAM.BANCS && params.mandate_type == QUERY_PARAM.NACH && params.bank_code == QUERY_PARAM.HDFC && params.extension == QUERY_PARAM.txt || FILE_FORMAT.TXT) || (params.source_system == QUERY_PARAM.BANCS && params.mandate_type == QUERY_PARAM.AD && params.extension == QUERY_PARAM.txt || FILE_FORMAT.TXT) || (params.source_system == QUERY_PARAM.BANCS && params.mandate_type == QUERY_PARAM.LEG && params.extension == QUERY_PARAM.txt || FILE_FORMAT.TXT)) {
                if(params.source_system === QUERY_PARAM.FINNONE && params.extension === QUERY_PARAM.csv && (params.mandate_type === QUERY_PARAM.NACH || params.mandate_type === QUERY_PARAM.AD || params.mandate_type === QUERY_PARAM.UPI)){
                    // if(FileName.indexOf(' ') > 0){
                    //     return({
                    //         status:409,
                    //         Message:"Found Space in File Name"
                    //       })
                    // } else { 
                        const result = debitUploadLambda(params?.key)
                        return {status:200};
                    // }
                 } else {
                    const result = await debitUploadLocalProcess(params);
                    if(result.status === 200){
                        console.log(result);
                        console.log("Successfully process completed");
                    }
                    return result;  
                 } 
            } else {
                return({
                    status:500,
                    Message:'Something Went Wrong'
                });
            }
        } catch(err){
            console.log("err",err);
            throw err;
        }
    }

    // DOWNLOAD REJECTED PICKLIST
    export const downloadPicklistReject = async(batchId) =>{
            try {
                let queryResults = await fetchAllData({
                  attributes:[QUERY_PARAM.BATCH_ID,QUERY_PARAM.MANDATE_TYPE,QUERY_PARAM.BANK_CODE,QUERY_PARAM.SOURCE_SYSTEM1,QUERY_PARAM.LOAN_NO,QUERY_PARAM.CUSTOMER_NAME,QUERY_PARAM.ACCOUNT_NUMBER,QUERY_PARAM.MANDATE_START,QUERY_PARAM.MANDATE_AMOUNT,QUERY_PARAM.UPLOAD_STATUS,QUERY_PARAM.RESPONSE_REJECTION_REASON,QUERY_PARAM.UPLOAD_REJECT_REASON,QUERY_PARAM.PRESENTATION_REMARK,QUERY_PARAM.PRESENTATION_MODE],
                  where:{
                    batch_id:{
                      [Op.like]:[batchId]
                    }
                  },
               
                },models["debit_tran_res"])
                let downloadData = [];
                for (const queryResult of queryResults) {
                  downloadData.push({
                    'Batch Id': queryResult.batch_id,
                    'Mandate Type': queryResult.mandate_type,
                    'Bank Code': queryResult.bank_code,
                    'Source System': queryResult.source_system,
                    'Loan No': queryResult.loan_no,
                    'Customer Name': queryResult.customer_name,
                    'Account Number': queryResult.presentment_mode !== QUERY_PARAM.REPRESENTATION
                      ? queryResult.account_number
                      : QUERY_PARAM.NULL,
                    'Debit Date': moment(queryResult.mandate_start).format(DATE_FORMAT.DD_MM_YYYY),
                    'Amount': queryResult.mandate_amount,
                    'Status': "Reject",
                    'Reason': queryResult.upload_reject_reason !== null
                      ? queryResult.upload_reject_reason
                      : "Duplicate entry"
                  });
                }
                return downloadData;
            } catch (ex) {
              logger.error("Picklist Reject File Download",ex);
              throw ex;
            }
    }