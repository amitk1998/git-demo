import { logger } from "filelogger";
import axios from "axios"
const ENV= process.env.NODE_ENV || 'development';
import moment from 'moment'
import { FUNCTION_NAME, LOGGER_CODES, MODULE_NAME, SUB_MODULE_NAME, RES_MSG,RES_CODE } from "../constants";
import { v4 as uuidv4 } from 'uuid';
import { ResponseHandler, MastersResponseBody } from '../utils'
// import {logger}  from '../modules/filelogger'
import { callbackResponse, executeApiTransection, notifyUPIUsers, upiTransectionStatus,processCsvData } from "../services/upiServices";
const moduleName = MODULE_NAME.UPI_ICICI
const subModuleName = SUB_MODULE_NAME.NOTIFY_USER_API
const timestamp = moment().toISOString()
const responseHandler = new ResponseHandler()

// const csv = require('csv-parser');
// const { Readable } = require('stream');
// import  models  from '../database/index.js'


/**
 * 
 * @param {object} req 
 * @param {object} res 
 */
export const upiNotifyUser = async (req,res)=>{
    const functionName = FUNCTION_NAME.NOTIFY_USER
    const requestId = uuidv4()
    try {    
        console.log('<--------------------- Notify API Call ------------------>');
        logger.info(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users request  : ${JSON.stringify(
              req.body
            )} | ${functionName} | ${LOGGER_CODES.INFO}`
        )
        const response = await notifyUPIUsers(requestId)
        res.json({status:200,data:"success"})
        
        
    } catch (error) {
        console.log('Error --->', error);
        logger.error(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users Error  : ${JSON.stringify(
              error
            )} | ${functionName} | ${LOGGER_CODES.ERROR}`
        )
    }
}

/**
 * 
 * @param {object} req 
 * @param {object} res 
 */
export const upiExecuteTransection = async (req,res)=>{
    const functionName = FUNCTION_NAME.EXECUTE_UPI_TRANSECTION
    const requestId = uuidv4()
    try {    
        console.log('<--------------------- Execute API Call ------------------>');
        logger.info(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users request  : ${JSON.stringify(
              req.body
            )} | ${functionName} | ${LOGGER_CODES.INFO}`
        )
        const response = await executeApiTransection(requestId)

        res.json({status:200,data:"success",data:response})
        
    } catch (error) {
        console.log('Error --->', error);
        logger.error(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users Error  : ${JSON.stringify(
              error
            )} | ${functionName} | ${LOGGER_CODES.ERROR}`
        )
    }
}

/**
 * 
 * @param {object} req 
 * @param {object} res 
 */
export const upiStatusTransection = async (req,res)=>{
    const functionName = FUNCTION_NAME.UPI_TRANSECTION_STATUS
    const mandateTransID=req.body.mandateTransID;
    const requestId = uuidv4()
    try {    
        console.log('<--------------------- Status API Call ------------------>');
        logger.info(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users request  : ${JSON.stringify(
              req.body
            )} | ${functionName} | ${LOGGER_CODES.INFO}`
        )
        const response = await upiTransectionStatus(requestId,mandateTransID)
        res.json({status:200,msg:"success",data:response})
        
    } catch (error) {
        console.log('Error --->', error);
        logger.error(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users Error  : ${JSON.stringify(
              error
            )} | ${functionName} | ${LOGGER_CODES.ERROR}`
        )
        res.json({status:400,data:"false"})
    }
}


export const upiCallback = async (req,res)=>{
    const functionName = FUNCTION_NAME.UPI_TRANSECTION_STATUS
    const body=req.body;
    const requestId = uuidv4()
    try {    
        console.log('<--------------------- Status API Call ------------------>');
        logger.info(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users request  : ${JSON.stringify(
              req.body
            )} | ${functionName} | ${LOGGER_CODES.INFO}`
        )
        const response = await callbackResponse(requestId,body,res)
        res.json({status:200,msg:"success",data:response})
        
    } catch (error) {
        console.log('Error --->', error);
        logger.error(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Notify UPI Users Error  : ${JSON.stringify(
              error
            )} | ${functionName} | ${LOGGER_CODES.ERROR}`
        )
        res.json({status:400,data:"false"})
    }
}



  

// export const processCsvFromS3 = async (req, res) => {
//     const s3Key = req.body.s3Key;
//     const bucket = process.env.BUCKET_NAME;
    
//     try {
//       console.log('<--------------------- Process CSV from S3 ------------------>');
  
//       // Read CSV data from S3
//       const csvData = await readFilesfromS3(bucket, s3Key);
//       console.log("Raw CSV Data:", csvData);
  
//       // Array to hold JSON data
//       const jsonData = [];
  
//       // Parse CSV data
//       Readable.from(csvData)
//         .pipe(csv())
//         .on('data', (row) => {
//           jsonData.push(row);
//         })
//         .on('end', async () => {
//           console.log('CSV file successfully processed');
  
//           // Batch size for processing records
//           const batchSize = 100;
//           const totalRecords = jsonData.length;
//           console.log(":::::::::::::totalRecords",totalRecords)
//           let batchStartIndex = 0;
  
//           while (batchStartIndex < totalRecords) {
//             const batchRecords = jsonData.slice(batchStartIndex, batchStartIndex + batchSize);
//             batchStartIndex += batchSize;
  
//             // Process each record in the current batch
//             for (const record of batchRecords) {
//                 console.log("::::::::::::::::::::::record",record)
//               if (record.mandate_type === 'UPI Mandate' &&
//                   record.account_number &&
//                   record.mandate_date &&
//                   record.mandate_amount) {
  
//                     const mandateStartDate = moment(record.mandate_date, 'DD/MM/YY').format('YYYY-MM-DD hh:mm:ss');
//                 console.log(">>>>>>>>>>>>>>",mandateStartDate)
//                 // Check if record exists based on multiple conditions
//                 const existingRecord = await models.debit_tran_reg.findOne({
//                   where: {
//                     mandate_type: record.mandate_type,
//                     mandate_start: mandateStartDate,
//                     account_number: record.account_number,
//                     mandate_amount: parseFloat(record.mandate_amount)
//                   }
//                 });
//   console.log(":::>>>>>>>>>>>>>existingRecord",existingRecord)
//   let currentTime =  moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
//   console.log("::::::::::::currentTime",currentTime)
//                 if (existingRecord) {
//                   // Update existing record
//                   await models.debit_tran_reg.update(
//                     {
//                       response_status: 'success',
//                       upi_merchant_trans_execution_status: 'success',
//                       upi_merchant_trans_execution_remark: 'success',
//                       upi_merchant_trans_execution_time: currentTime,
//                       upi_merchant_trans_execution_response: 'manual Payment',
//                       upi_merchant_trans_execution_id: 'manual Payment'
//                     },
//                     {
//                       where: {
//                         mandate_type: record.mandate_type,
//                         mandate_start: mandateStartDate,
//                         account_number: record.account_number,
//                         mandate_amount: parseFloat(record.mandate_amount)
//                       }
//                     }
//                   );
//                 }
//               }
//             }
//           }
  
//           res.json({ status: 200, msg: "success", data: jsonData });
//         })
//         .on('error', (err) => {
//           console.error('Error processing CSV file:', err);
//           res.status(500).json({ status: 400, msg: "Error processing file", error: err.message });
//         });
  
//     } catch (error) {
//       console.error('Error --->', error);
//       res.status(500).json({ status: 400, msg: "Error processing file", error: error.message });
//     }
//   };
  

// export const processCsvFromS3 = async (req, res) => {
//     let id = req.query.id
//     const s3Key = req.body.s3Key;
//     const bucket = process.env.BUCKET_NAME;
    
//     try {
//       console.log('<--------------------- Process CSV from S3 ------------------>');
    
//       // Read CSV data from S3
//       const csvData = await readFilesfromS3(bucket, s3Key);
//       console.log("Raw CSV Data:", csvData);
    
//       // Array to hold JSON data
//       const jsonData = [];
    
//       // Parse CSV data
//       Readable.from(csvData)
//         .pipe(csv())
//         .on('data', (row) => {
//           jsonData.push(row);
//         })
//         .on('end', async () => {
//           console.log('CSV file successfully processed');
    
//           // Total records count
//           const totalRecords = jsonData.length;
//           console.log(":::::::::::::totalRecords", totalRecords);
          
//           // Batch size for processing records
//           const batchSize = 100;
//           let batchStartIndex = 0;
//           let successCount = 0;
//           let failedCount = 0;
    
//           while (batchStartIndex < totalRecords) {
//             const batchRecords = jsonData.slice(batchStartIndex, batchStartIndex + batchSize);
//             batchStartIndex += batchSize;
    
//             // Process each record in the current batch
//             for (const record of batchRecords) {
//               console.log("::::::::::::::::::::::record", record);
//               if (record.mandate_type === 'UPI Mandate' &&
//                   record.account_number &&
//                   record.mandate_date &&
//                   record.mandate_amount) {
    
//                 const mandateStartDate = moment(record.mandate_date, 'DD/MM/YY').format('YYYY-MM-DD HH:mm:ss');
//                 console.log(">>>>>>>>>>>>>>", mandateStartDate);
                
//                 // Check if record exists based on multiple conditions
//                 const existingRecord = await models.debit_tran_reg.findOne({
//                   where: {
//                     mandate_type: record.mandate_type,
//                     mandate_start: mandateStartDate,
//                     account_number: record.account_number,
//                     mandate_amount: parseFloat(record.mandate_amount)
//                   }
//                 });
//                 console.log(":::>>>>>>>>>>>>>existingRecord", existingRecord);
//                 let currentTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
//                 console.log("::::::::::::currentTime", currentTime);
                
//                 if (existingRecord) {
//                   // Update existing record
//                   const [updateCount] = await models.debit_tran_reg.update(
//                     {
//                       response_status: 'success',
//                       upi_merchant_trans_execution_status: 'Success',
//                       upi_merchant_trans_execution_remark: 'Success',
//                       upi_merchant_trans_execution_time: currentTime,
//                       upi_merchant_trans_execution_response: 'manual Payment',
//                       upi_merchant_trans_execution_id: 'manual Payment'
//                     },
//                     {
//                       where: {
//                         mandate_type: record.mandate_type,
//                         mandate_start: mandateStartDate,
//                         account_number: record.account_number,
//                         mandate_amount: parseFloat(record.mandate_amount)
//                       }
//                     }
//                   );
                  
//                   if (updateCount > 0) {
//                     successCount++;
//                   } else {
//                     failedCount++;
//                   }
//                 } else {
//                   failedCount++;
//                 }
//               }
//             }
//           }
    
//           // Update the log table with the counts
//           await models.file_execution_logs.update(
//             {
//               file_status: 'Success',
//               total_records: totalRecords,
//               success_records: successCount,
//               failed_records: failedCount
//             },
//             {
//               where: {
//                 id: id
//               }
//             }
//           );
    
//           res.json({ status: 200, msg: "success file proccess successfully"});
//         })
//         .on('error', (err) => {
//           console.error('Error processing CSV file:', err);
//           res.status(500).json({ status: 400, msg: "Error processing file", error: err.message });
//         });
  
//     } catch (error) {
//       console.error('Error --->', error);
//       res.status(500).json({ status: 400, msg: "Error processing file", error: error.message });
//     }
//   };
  

export const processCsvFromS3 = async (req, res) => {
    const functionName = FUNCTION_NAME.PROCESS_CSV_FROM_S3
    const requestId = uuidv4()
    logger.info(
        `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | ${functionName} | ${LOGGER_CODES.INFO}`
    )
    const id = req.query.id;
    const s3Key = req.body.s3Key;
    const bucket = process.env.BUCKET_NAME;
    
    try {
        console.log('<--------------------- Process CSV from S3 ------------------>');
        const result = await processCsvData(bucket,res, s3Key, id);
    } catch (error) {
        logger.error(
            `${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | ${functionName} | ${LOGGER_CODES.ERROR}`
        )
        console.error('Error --->', error);
        return responseHandler.MasterHandleBody( new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, {}),
      res)
    }
};