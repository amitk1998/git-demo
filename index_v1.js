const moment = require('moment'),
    { logger } = require("../../modules/filelogger"),
    constantUtilityAndIfscCode = require('../../config/debit_trans_f1_constant/constant.json')['production'];
let async = require('async');
import  models  from '../../database'
import {updateData,fetchAllData, countData} from "../crud"
// import deMerge from '../debitTransactionDemerge/index';
import {chunkArray} from '../debitTransactionDemerge/index'; 
import {Op } from 'sequelize';
import {executeWithoutPDNApiTransection} from '../../services/upiServices';
import { insertService } from '../crud';
let crypto = require('crypto'); 
import _ from 'lodash';
import { DATE_FORMAT, QUERY_PARAM, RES_MSG, S3_FILE_PATH, TABLE_NAMES , UtilityCodes } from '../../constants';


    //DATA PROCESSING 
    export const  dataFormation = async (params,pData) =>{
        try {
            let dataArray = [];
            let rejectedArray = [];

            const fileData = await readData(params,pData);
            // console.log("=============",fileData);

            const start = async () => {
                const asyncForEach = async (array, callback) => {
                    for (let index = 0; index < array.length; index++) {
                        await callback(array[index], index, array)
                    }
                };
                await asyncForEach(fileData, async (eachRecord) => {
                    // console.log("eachRecord:", eachRecord)
                    let mandate_type = (eachRecord.mandate_type).toUpperCase();
                    let mandateType;
                    switch (mandate_type) {
                        case 'AUTO DEBIT':
                            mandateType = 'AD';
                            break;
                        case 'AUTODEBIT':
                            mandateType = 'AD';
                            break;
                        case 'LEGACY':
                            mandateType = 'LEG';
                            break;
                        default:
                            mandateType = mandate_type;
                            break;
                    }
                    let bankCode = eachRecord.bank_code;
                    let loanNo = eachRecord.loan_no;
                    let source_system = eachRecord.source_system;
                    let sourceSystem = (source_system).toUpperCase();

                    let isUmrnNoPresent = eachRecord.umrn_no === (null || '' || undefined || 'NULL' || 'null') ? false : true;

                    let validationParams = { mandateType, bankCode, loanNo };
                    let isBankCodeValid = await CheckBankCodeIsValid(validationParams);

                    let mandateDate;
                    let typeOfValueIsDate = moment.isDate(eachRecord.mandate_start);

                    let isValidDate = moment(eachRecord.mandate_start, 'DD-MM-YYYY', true).isValid();

                    if (typeOfValueIsDate === true && isValidDate === true) {
                        mandateDate = moment(eachRecord.mandate_start, 'DD-MM-YYYY').format('YYYY-MM-DD');

                        let addOneDayInDate = moment(mandateDate).add(1, 'days');

                        mandateDate = moment(addOneDayInDate, 'YYYY-MM-DD').format('YYYY-MM-DD');

                    } else if (typeOfValueIsDate !== true && isValidDate === true) {
                        mandateDate = moment(eachRecord.mandate_start, 'DD-MM-YYYY').format('YYYY-MM-DD');
                    } else {
                        mandateDate = 'Invalid date';
                    }

                    let regex = /^\d+(\.\d{1,2})?$/;
                    let isSpecialCharInAmt = regex.test(eachRecord.mandate_amount) ? false : true;
                    // let isSpecialCharInLoanNo = regex.test(eachRecord.loan_no) ? false : true;
                    let isSpecialCharInAccNo = regex.test(eachRecord.account_number) ? false : true;

                    let lastTwoDigitOfLoan = eachRecord?.loan_no ? eachRecord.loan_no.toString().slice(-2):'';
                    let timeInUnix = moment().unix();
                    let lastFourDigitOfUnix = timeInUnix.toString().slice(-4);
                    let lastTwoDigitOfUmrnNo = eachRecord?.umrn_no ? eachRecord.umrn_no.toString().slice(-4, -2):'';

                    const legUtilityCode = await findLegUtilityCode(validationParams);
                    let finalUtility;
                    if (legUtilityCode) {
                        finalUtility = legUtilityCode.map(a => a.utility_code);
                    }
                    const utilityCode = mandateType === 'LEG' ? finalUtility[0] : await constantUtilityAndIfscCode[eachRecord.company_code];
                    const sponsorBankIfsc = constantUtilityAndIfscCode.sponsor_bank_ifsc_code;

                    let filterFiles = sourceSystem === 'FINNONE' ? 'F1 Representation Upload File' : sourceSystem === 'BANCS' ? 'Bancs Representation Upload File' : 'Other Representation Upload File';
                    let sourceSystemUniqueNo = await generateUniqueNumber();

                    let formattedJson = (isBankCodeValid === true && isSpecialCharInAmt === false && isSpecialCharInAccNo === false && mandateDate !== 'Invalid date' && isUmrnNoPresent === true) ? {
                        'mandate_type': mandateType,
                        'bank_code': eachRecord.bank_code,
                        'source_system': sourceSystem,
                        'company_code': eachRecord.company_code,
                        'loan_no': eachRecord.loan_no,
                        'mandate_start': mandateDate,
                        'account_number': eachRecord.account_number,
                        'umrn_no': eachRecord.umrn_no,
                        'customer_name': eachRecord.customer_name,
                        'mandate_amount': eachRecord.mandate_amount,
                        'presentment_mode': eachRecord.presentment_mode,
                        'micr_code': eachRecord.micr_code,
                        'ifsc_code': eachRecord.ifsc_code,
                        'sponsor_bank_ifsc': sponsorBankIfsc,
                        // 'source_system_uniq_number': sourceSystemUniqueNo,
                        'source_system_uniq_number': lastTwoDigitOfLoan + lastFourDigitOfUnix + lastTwoDigitOfUmrnNo,
                        'batch_id': params.batchId,
                        'utility_code': utilityCode,
                        'account_type': 10,
                        'product_code': mandateType === 'LEG' ? 'LEG' : 10,
                        'record_belongs_from': filterFiles,
                        'isActiveForMerge': false,
                        'upload_status': 'Success'
                    } : null;

                    let isRecordRejected = (isBankCodeValid !== true || isSpecialCharInAmt === true || isSpecialCharInAccNo === true || mandateDate === 'Invalid date' || isUmrnNoPresent === false) ? true : false;

                    let rejectionReason = isBankCodeValid === false ? 'Bank code and mandate type are not linked' : isUmrnNoPresent === false ? 'Found incorrect/missing UMRN Number' : isSpecialCharInAmt === true ? 'Found special character in Amount' : mandateDate === 'Invalid date' ? 'Invalid date' : 'Found special character in Account Number';

                    let rejectedJson = (isRecordRejected === true) ? {
                        'mandate_type': mandateType,
                        'bank_code': eachRecord.bank_code,
                        'source_system': sourceSystem,
                        'company_code': eachRecord.company_code,
                        'loan_no': eachRecord.loan_no,
                        'mandate_start': mandateDate,
                        'account_number': eachRecord.account_number,
                        'umrn_no': eachRecord.umrn_no,
                        'customer_name': eachRecord.customer_name,
                        'mandate_amount': eachRecord.mandate_amount,
                        'presentment_mode': eachRecord.presentment_mode,
                        'micr_code': eachRecord.micr_code,
                        'ifsc_code': eachRecord.ifsc_code,
                        'sponsor_bank_ifsc': sponsorBankIfsc,
                        // 'source_system_uniq_number': sourceSystemUniqueNo,
                        'source_system_uniq_number': lastTwoDigitOfLoan + lastFourDigitOfUnix + lastTwoDigitOfUmrnNo,
                        'batch_id': params.batchId,
                        'utility_code': utilityCode,
                        'account_type': 10,
                        'product_code': mandateType === 'LEG' ? 'LEG' : 10,
                        'record_belongs_from': filterFiles,
                        'upload_status': 'Reject',
                        'upload_reject_reason': rejectionReason
                    } : null;

                    const pushArray = isRecordRejected !== true ? dataArray.push(formattedJson) : rejectedArray.push(rejectedJson);
                });
                let response = { dataArray: dataArray, rejectedArray: rejectedArray, totalCount: fileData.length };
                console.log("response",response);
                return response;
            };

            return start().catch((err) => {
                logger.error({ message: `ERROR IN representation formatJson :: ${err}` });
                throw err;
            });

        } catch (err) {
            throw err;
        }
    }

    //INSERT INTO DEBIT TRANS REG
    export const  insertIntoDebitReg = async(params, tCount) => {
        try {
            let successCount = 0;
            let rejectedCount = 0;
            let arrayChunk = await chunkArray(params, 5000);

            for (const eachChunk of arrayChunk) {
                try {
                    // console.log("each Record: ", eachChunk)
                    const bulkCreate = await models.debit_tran_reg.bulkCreate(eachChunk, { validate: true });
                    // successCount = params.length - rejectedCount;
                    continue;
                } catch (error) {
                    logger.error({ message: `Error in catch 1 :: ${error}` });
                    const saveRejected = await save_represent_rejected_records(eachChunk);
                    // console.log("saveRejected Data",saveRejected,"params",params.length);
                    successCount = params.length - saveRejected.failureCountData;
                    rejectedCount = saveRejected.failureCountData;
                    continue;
                }
            }
            // console.log("count",tCount);
            let countStatus = {
                totalCount: tCount,
                // successCount: successCount,
                successCount: params.length - rejectedCount,
                rejectedCount: rejectedCount
            }
            console.log("countStatus",countStatus)
            return countStatus;
        } catch (ex) {
            throw ex;
        }
    }

    //SAVE REPRESENTATION REJECT RECORDS
    export const  save_represent_rejected_records = async(dataArray) =>{
        try {
            let rejectedCount = 0;
            let successCountData = 0;
            for (const eachRecord of dataArray) {
                try {
                  console.log(eachRecord)
                    const createOne = await models.debit_tran_reg.create(eachRecord);
                } catch (error) {
                    rejectedCount++;
                    logger.error({ message: `Error in catch 2 :: ${error}` });
                    eachRecord.upload_status = 'Reject';
                    eachRecord.upload_reject_reason = 'Duplicate Record';
                    // try{
                    const debitResCreate = await models.debit_tran_res.create(eachRecord);
                    continue;
                    // }
                    // catch(err){
                    //     console.log(err);
                    // }
                }
            }
            return ({ failureCountData: rejectedCount, successCountData: successCountData });
        } catch (error) {
            logger.error({ message: `Error in save_represent_rejected_records :: ${error}` });
            throw error;
        }
    }

    //INSERT INTO DEBIT TRANS RES
    export const  insertIntoDebitRes = async (params) =>{
        try {
            let rejectedCount = 0;
            let arrayChunk = await chunkArray(params, 5000);
            for (const eachChunk of arrayChunk) {
                console.log(eachChunk);
                const insertInRes = await models.debit_tran_res.bulkCreate(eachChunk);
                rejectedCount = insertInRes.length;
                continue;
            }
            return rejectedCount;
        } catch (err) {
            // logger.error({ message: `Error in insertIntoDebitRes :: ${err}` });
            throw err;
        }
    }

    //UPDATE COUNT AND STATUS IN INTEGRATION BILL UPLOAD RESPONSE
    export const  updateCountAndStatus = async (params) =>{
        // console.log("update",params);
        const result = await models.debit_tran_reg_file_upload_status.update({
            upload_status: params.status,
            total_count: params.totalCount,
            succuss_count: params.successCount,
            rejected_count: params.rejectedCount,
            pending_count: 0
        }, { where: { batch_id: params.batchId } });
        return true;
    }

export const CheckBankCodeIsValid = async (params) =>{
        const isValidate = await fetchAllData({ where: { bank_code: params.bankCode, mandate_type: params.mandateType } },models["sponsorBank"]);
        let result = isValidate.length > 0 ? true : false;
        console.log("check bank code is valid",result);
        return result;
    }

    //FIND LEG UTILITY CODE
    export const  findLegUtilityCode = async (params) =>{
        try {
            // console.log("mandate type of legUtility",params);
            if (params.mandateType === 'LEG') {
                const utilityCode = await fetchAllData({
                    where: {
                        loan_no: params.loanNo
                    }
                },models["leg_utility_master"]);
                return utilityCode;
            } else {
                return false;
            }
        } catch (error) {
            throw error;
        }
    }

    //GENERATE UNIQUE NUMBER 
    export const  generateUniqueNumber = async() =>{
        const getRandomNumber = crypto.randomInt(0, 50);
        let formatNumber = getRandomNumber.toString().slice(-8);
        return formatNumber;
    }

    //READ DATA 
    export const readData = async (params, pData) => {
        let fileData = []
        try {
          for (const element of pData) {
            const line = element
            const arr = line.split(',')
            if (arr.length !== 1) {
              const jsonObject = {
                mandate_type: arr[0],
                bank_code: arr[1],
                source_system: arr[2],
                company_code: arr[3],
                loan_no: arr[4],
                mandate_start: arr[5],
                account_number: arr[6],
                umrn_no: arr[7],
                customer_name: arr[8],
                mandate_amount: arr[9],
                presentment_mode: arr[10],
                micr_code: arr[11],
                ifsc_code: arr[12],
                batch_id: params.batchId,
                isActiveForMerge: false,
                upload_status: 'Success'
              }
      
              fileData.push(jsonObject)
            }
          }
          
          fileData.shift()
          return fileData
        } catch (err) {
          throw err
        }
      }
        
    

    //CREATE BATCHID 
    export const  batchIdGeneration = async(params) =>{
        const data = await models.debit_tran_reg_file_upload_status.create({});
        const updateResponse = await updateData({
            update:{
          batch_id: data.id,
          upload_date_time: params.uploadDate,
          user_name: params.userName,
          file_name: params.fileName,
          upload_status: params.job_status,
          succuss_count: params.success,
          total_count: params.total,
          rejected_count: params.reject,
          pending_count: params.pending
        }, 
        whereQuery: {
            id: data.id
          }
        },models["debit_tran_reg_file_upload_status"]);
        let response = data.id;
        console.log('response =====>',response);
        return response
      
      }
    
    //STORE REJECTED RECORDS 
    export const  store_manual_rejected_records = async(data) =>{
        async.each(data, function (_arrayData, _callback) {
          models.debit_tran_reg.create({
            batch_id: _arrayData['batch_id'],
            mandate_type: _arrayData['mandate_type'],
            bank_code: _arrayData['bank_code'],
            company_code: _arrayData['company_code'],
            source_system: _arrayData['source_system'],
            sponsor_bank_ifsc: _arrayData['sponsor_bank_ifsc'],
            presentment_mode: _arrayData['presentment_mode'],
            utility_code: _arrayData['utility_code'],
            loan_no: _arrayData['loan_no'],
            tpls_instrument_ref_no: _arrayData['tpls_instrument_ref_no'],
            account_type: _arrayData['account_type'],
            customer_name: _arrayData['customer_name'],
            account_number: _arrayData['account_number'],
            mandate_start: _arrayData['mandate_start'],
            mandate_amount: _arrayData['mandate_amount'],
            micr_code: _arrayData['micr_code'],
            source_system_uniq_number: _arrayData['source_system_uniq_number'],
            umrn_no: _arrayData['umrn_no'],
            product_code: _arrayData['product_code'],
            upload_status: _arrayData['upload_status']
          });
        }, function (err) {
          if (err) {
            console.log(err);
          } else {
            resolve({ status: true, data: failureCountData });
          }
        });
      }

    //CONVERT DATA INTO JSON
    // export const  convertDataIntoJson = (json_data, params) => {
    //     try {
    //         return new Promise((resolve, reject) => {
    //             let array = [];
    //             let rejectArray = [];
    //             async.each(json_data, (each_data, cb) => {
    
    //                 let cycle_date;
    //                 let typeOfValueIsDate = moment.isDate(each_data.K);
    
    //                 let isValidDate = moment(each_data.K, 'DD-MM-YYYY', true).isValid();
    
    //                 if (typeOfValueIsDate === true && isValidDate === true) {
    //                     cycle_date = moment(each_data.K).format('YYYY-MM-DD');
    
    //                     let addOneDayInDate = moment(cycle_date).add(1, 'days');
    
    //                     cycle_date = moment(addOneDayInDate, 'YYYY-MM-DD').format('YYYY-MM-DD');
    
    //                 } else if (typeOfValueIsDate !== true && isValidDate === true) {
    //                     cycle_date = moment(each_data.K, 'DD-MM-YYYY').format('YYYY-MM-DD');
    //                 } else {
    //                     console.log(" both not satisfied ");
    //                 }
    
    //                 let sponsor_bank_code = each_data.D;
    //                 let loan_no = each_data.E;
    //                 let source_system = (each_data.A).toUpperCase();
        
    //                 let account_number = each_data.F;
    //                 let umrn_no = each_data.L;
    //                 let customer_name = each_data.G;
    //                 let mandate_amount = each_data.J;
    //                 let presentment_mode = each_data.B;
    //                 let sponsor_bank_ifsc = each_data.H;
    //                 let account_type = each_data.I;
    //                 let mandateType = (each_data.C).toUpperCase();
    //                 let mandate_type = mandateType === 'AUTO DEBIT' ? 'AD' : mandateType === 'LEGACY' ? 'LEG' : mandateType;
    //                 let legParams = { mandate_type, loan_no };
    //                 let validateBankCode;
    //                 findBankCode(sponsor_bank_code, mandate_type).then(bankCode => {
    //                     if (bankCode.err) {
    //                         bankCode.data = '';
    //                         validateBankCode = false;
    //                     } else {
    //                       //  bankCode.data = bankCode.data;
    //                         validateBankCode = true;
    //                     }
    //                     findLegUtilityCode(legParams).then(async (legUtilityCode) => {
    //                         let finalUtility;
    //                         if (legUtilityCode) {
    
    //                             finalUtility = legUtilityCode.map(a => a.utility_code);
    //                         }
    //                         const utilityCode = mandate_type === 'LEG' ? finalUtility[0] : await constantUtilityCode[params.company_code];
    
    //                         // let filterFiles = source_system === 'FinnOne' ? 'F1 Manual Upload File' : source_system === 'BaNCs' || 'BaNCS' || 'BANCS' ? 'Bancs Manual Upload File' : 'Other Manual Upload File';
    //                         let filterFiles = source_system === 'FINNONE' ? 'F1 Manual Upload File' : source_system === 'BANCS' ? 'Bancs Manual Upload File' : 'Other Manual Upload File';
    //                         let sourceSystem = source_system === 'FinnOne' ? 'FINNONE' : source_system === 'BaNCs' ? 'BANCS' : source_system === 'BaNCS' ? 'BANCS' : source_system;
    //                         let lastTwoDigitOfLoan = loan_no.toString().slice(-2);
    //                         let timeInUnix = moment().unix();
    //                         let lastTwoDigitOfUnix = timeInUnix.toString().slice(-2);
    //                         let lastFourDigitOfUmrnNo = umrn_no.toString().slice(-4);
    
    //                         if(validateBankCode === true){
    //                         let json_value = {
    //                             'batch_id': params.batchId,
    //                             'mandate_type': mandate_type,
    //                             'bank_code': bankCode.data,
    //                             'source_system': source_system,
    //                             'company_code': params.company_code,
    //                             'loan_no': loan_no,
    //                             'mandate_start': cycle_date,
    //                             'account_number': account_number,
    //                             'umrn_no': umrn_no,
    //                             'customer_name': customer_name,
    //                             // 'mandate_amount': ((sourceSystem === 'FINNONE' || 'FinnOne') && bankCode.data === 'HDFC') ? (mandate_amount * 100) : mandate_amount,
    //                             'mandate_amount': bankCode.data === 'HDFC' ? (mandate_amount * 100) : mandate_amount,
    //                             'presentment_mode': 'Presentation', // 'presentment_mode': presentment_mode,
    //                             'sponsor_bank_ifsc': 'HDFC0000060',
    //                             'ifsc_code': sponsor_bank_ifsc,
    //                             'utility_code': utilityCode,
    //                             'account_type': 10,
    //                             'product_code': mandate_type == 'LEG' ? "LEG" : 10,
    //                             'upload_status': 'Success',
    //                             'record_belongs_from': filterFiles,
    //                             'source_system_uniq_number': lastTwoDigitOfLoan + lastTwoDigitOfUnix + lastFourDigitOfUmrnNo,
    //                             'validateBankCode': validateBankCode
    //                         }
    //                         array.push(json_value);
    //                     }else{
    //                         let reject_json_value = {
    //                             'batch_id': params.batchId,
    //                             'mandate_type': mandate_type,
    //                             'bank_code': bankCode.data,
    //                             'source_system': source_system,
    //                             'company_code': params.company_code,
    //                             'loan_no': loan_no,
    //                             'mandate_start': cycle_date,
    //                             'account_number': account_number,
    //                             'umrn_no': umrn_no,
    //                             'customer_name': customer_name,
    //                             'mandate_amount': ((sourceSystem === 'FINNONE' || 'FinnOne') && bankCode.data === 'HDFC') ? (mandate_amount * 100) : mandate_amount,
    //                             // 'mandate_amount': bankCode.data === 'HDFC' ? (mandate_amount * 100) : mandate_amount,
    //                             'presentment_mode': presentment_mode,
    //                             'sponsor_bank_ifsc': 'HDFC0000060',
    //                             'ifsc_code': sponsor_bank_ifsc,
    //                             'utility_code': utilityCode,
    //                             'account_type': 10,
    //                             'product_code': mandate_type == 'LEG' ? "LEG" : 10,
    //                             'upload_status': 'Reject',
    //                             'upload_reject_reason':'Bank code is not valid',
    //                             'record_belongs_from': filterFiles,
    //                             'source_system_uniq_number': lastTwoDigitOfLoan + lastTwoDigitOfUnix + lastFourDigitOfUmrnNo,
    //                             'validateBankCode': validateBankCode
    //                         }
                            
    //                         rejectArray.push(reject_json_value);
    //                     }
    //                         cb();
    //                     });
    //                 });
    //             }, (err) => {
    //                 if (err) {
    //                     reject(err);
    //                 } else {
    //                     let success_array = array;
    //                     let reject_array = rejectArray;
    //                     let count = Object.keys(json_data[0]).length;
    //                     if (count === 12) {
    //                         resolve({ status: true, success_array: success_array, reject_array: reject_array, extra: count });
    //                     }
    //                     else {
    //                         resolve({ status: false, success_array: success_array, reject_array: reject_array, extra: count });
    //                     }
    //                 }
    //             });
    //         });
    //     } catch (err) {
    //         console.log("file formation error", err);
    //         throw err;
    //     }
    // }

    //FIND BANK CODE 
    export const  findBankCode = async(sponsor_bank_code, mandate_type) =>{
        try {
          const result = await updateData({
            update:{
            attributes: ['bank_code']
            },
            whereQuery: {
              f1_picklist_bank_name: sponsor_bank_code,
              mandate_type: mandate_type
            }
          },models["sponsarBank"]);
          let bank_code = result[0]['bank_code'];
      
          let response = { data: bank_code, err: '' }
          return response;
        } catch (error) {
          let response = { data: '', err: error }
          return response;
        }
      
      }

    /**
     * Fetch BatchId on the basis of fileName
     * @param {*} string 
     * @returns 
     */
    export const  fetchFileList = async(string) =>{
        try {
           const fileList = await fetchAllData({
            where: {
              file_name: {
                [Op.like]:[string]
              }
            }, attributes: ['file_name', 'batch_id'],
            order: [
              ["id", "ASC"]
            ],
            limit:2,
            raw: true
          },models["debit_tran_reg_file_upload_status"]);
          console.log("------------>",fileList, "================================");
          return fileList;
        } catch (err) {
          logger.error({ message: `Error in fetchFileList  :: ${err}` });
          throw err;
        }
      }

    //PROCESS ALREADY PROCESSED FILE
    export const  ProcessFileAsAlreadyProcessed = async(params, fileList) =>{
        try {
            const isMerged = await checkDatabaseForMergedRecords(fileList);
            const isFileProcessingOnHalt = isMerged !== true ? await checkSystemCanAcceptFile(params) : { status: true };
            const updateRecords = isFileProcessingOnHalt.status !== true ? await updateOldRecords(fileList) : null;
            let response = {
                status: isFileProcessingOnHalt.status,
                message: isFileProcessingOnHalt.status === true ? isMerged === true ? 'Records Merged' : 'Same Date' : ''
            }
            return response;
        } catch (err) {
            logger.error({ message: `Error in ProcessFileAsAlreadyProcessed :: ${err}` });
            throw err;
        }
    } 
    
    //CHECKING DATABASE FOR MERGE RECORDS
    export const  checkDatabaseForMergedRecords = async(params) =>{
        try {
          let result;
          for(var i=0; i<params.length; i++) {
            let batchId = typeof (params[i].batch_id) === 'number' ? (params[i].batch_id).toString() : params[i].batch_id;
            result = await fetchAllData({ where: { batch_id: batchId, merge_flag: true, merge_batch_id: { [Op.ne]: null } } },models["debit_tran_reg"]);
          }
          let response = result.length > 0 ? true : false;
          return response;
        } catch (err) {
          logger.error({ message: `Error in checkDatabaseForMergedRecords :: ${err}` });
          throw err;
        }
      }

    //Function to check wheater the system will accept it or not
    export const  checkSystemCanAcceptFile = async(params) =>{
        try {
            const startTime = "09:30:00";
            const endTime = "15:00:00";
            let currentTime = moment().format("HH:mm:ss");
            let currentDate = moment().format('DDMMYY');
            // console.log("current Date",currentDate);
            let fileDate = params.file_name.substring(4, 10);
            // console.log("File date ==========>",fileDate);  
            let isSameDate = currentDate === fileDate ? true : false;
            // let isBlockingTime = params.user_role === 'COLLECTIONUSER' ? isSameDate === true ? (currentTime >= startTime && currentTime <= endTime) ? true : false : false : false;
            let isBlockingTime = false;
            logger.info({ message: `isBlockingTime response :: ${isBlockingTime}` });
            let response = {
                status: isBlockingTime,
                message: isBlockingTime === true ? 'Same Date' : ''
            }
            return response;
        } catch (err) {
            logger.error({ message: `Error in checkSystemCanAcceptFile :: ${err}` });
            throw err;
        }
    }  

    export const  updateOldRecords = async(params) =>{
        try {
          for(var i=0; i < params.length; i++) {
            console.log("----->",params[i]);
            let batchId = typeof (params[i].batch_id) === 'number' ? (params[i].batch_id).toString() : params[i].batch_id;
            console.log("---------->",params,"batch_id",params[i].batch_id);
            const response = await updateData(
              {
              update:{
              mandate_type: null,
              bank_code: null,
              company_code: null
            },
              
            whereQuery: {
                  batch_id: batchId,
                  // merge_flag: false,
                  mandate_type: {
                    [Op.ne]: 'UPI Mandate',
                  }
                }
              },models["debit_tran_reg"]);
            console.log('------------------>',response);
          }
         
          // return true;
        } catch (err) {
          logger.error({ message: `Error in updateOldRecords :: ${err}` });
          throw err;
        }
      }

    export const  createBatchId = async(params) =>{
        try {
        //   console.log("params------->",params);
        //   let param = { company_code:params.company_code, file_name: params.file_name, user_name: params.user_name, upload_date_time: new Date().toLocaleString(), upload_status: 'Processing' };
        //   console.log("-------------------------------->",param);
          // const incrementedBatch = await  models.debit_tran_reg_file_upload_status.max('batch_id', {});
          //  incrementedBatch === null ? '40001' : parseInt(incrementedBatch) + 1;

          const createData = await models.debit_tran_reg_file_upload_status.create(params);
           await updateData(
            {
            update:{
            batch_id: createData.id
          },
             whereQuery: {
                id: createData.id
              }
            },models["debit_tran_reg_file_upload_status"]);
          return createData.id;
        } catch (err) {
          logger.error({ message: `Error in createBatchId :: ${err}` });
          throw err;
        }
      }
    
    export const  fileProcessing = async(params,fileData) =>{
        try {
          console.log("params",params);
            let filePath = `download/${params.file_name}`;
            let formattedJson = await formatJson(params, filePath,fileData);
            console.log("Formatted data of file",formattedJson.dataArray.length, formattedJson.rejectedArray.length);
            const saveRecords = formattedJson !== null ? await saveRecordsInDb(params, formattedJson) : null;
            let recordsDetails = {
                batchId: params?.batchId,
                data: saveRecords
            }
            console.log("Records =================>",recordsDetails.data);
            const updateFileLogResponse = saveRecords !== null ? await updateFileLog(recordsDetails,params) : null;
        } catch (err) {
            logger.error({ message: `Error in fileProcessing :: ${err}` });
            throw err;
        }
    }
    export const saveRecordsInDb = async (params, data) => {
      try {
        let initialData = {
          totalCount: 0,
          failureCount: 0,
          successCount: 0
        }
        const totalC = data?.dataArray?.length
        const insertInDebitRes =
          data.rejectedArray.length > 0 ? await insertIntoDebitRes(data.rejectedArray) : null
        const insertInDebitReg =
          data.dataArray.length > 0
            ? await insertIntoDebitReg(data.dataArray, totalC)
            : { data: initialData }

        let response = {
          total_count: totalC + data.rejectedArray.length,
          rejected_count: insertInDebitReg?.rejectedCount
            ? parseInt(insertInDebitReg?.rejectedCount) + parseInt(data.rejectedArray.length)
            : data.rejectedArray.length,
          pending_count: 0
        }
        response.succuss_count = response.total_count - response.rejected_count
        console.log("Response",response);
        return response
      } catch (err) {
        logger.error({ message: `Error in saveRecordsInDb :: ${err}` })
        throw err
      }
    }
    
    export const updateFileLog = async(params,data) =>{
        try {
          const updateResponse = await updateData(
            {
            update:{
            upload_status: 'Success',
            succuss_count: params.data.succuss_count,
            rejected_count: params.data.rejected_count,
            total_count: params.data.total_count,
            pending_count: params.data.pending_count,
            file_name: data.file_name
          }, 
          whereQuery: {
              batch_id: params.batchId
            }
          },models["debit_tran_reg_file_upload_status"]);
          return updateResponse
        } catch (err) {
          logger.error({ message: `Error in updateFileLog :: ${err}` });
          throw err;
        }
      }
      export const addSeqNo = async (umrn)=>{
        try {
          const lastMonthStart = moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD HH:mm:ss');
            const lastMonthEnd = moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD HH:mm:ss');
            const checkLastMonthDataExists = await fetchAllData({
                where:{
                    umrn_no:umrn,
                    mandate_start:{
                        [Op.between]: [lastMonthStart, lastMonthEnd]
                    }
                },
                attributes:['emi_seq_no','response_status'],
                order: [['id', 'DESC']],
                raw:true
            },models["debit_tran_reg"]);
            if(checkLastMonthDataExists.length>0){
                const checkIfNoSuccessLastMonth = checkLastMonthDataExists.every(item => item.response_status !== '00');
                if(checkIfNoSuccessLastMonth){
                    return parseInt(checkLastMonthDataExists[0].emi_seq_no)+1;
                }
            }
            const res = await fetchAllData({
              where:{
                umrn_no:umrn,
                upi_merchant_trans_execution_status:'Success',
                mandate_type:'UPI Mandate'
              },
              attributes:['emi_seq_no'],
              order: [['emi_seq_no', 'DESC']],
              raw:true
            },models["debit_tran_reg"]);
            if(res[0]?.emi_seq_no){
              return parseInt(res[0]?.emi_seq_no) + 1;
            }
            else{
              return 2;
            }
        } catch (error) {
          throw error;
        }
      }
      export const withoutPDNExecution=async(umrn)=>{
        const res = await fetchAllData({
          where:{
            umrn_no:umrn,
            upi_notification:1,
            mandate_type:'UPI Mandate',
            upi_notification_retry: { [Op.lt]: 10 },
            icic_notify_remark:'Transaction Successful',
            upi_merchant_trans_execution_status:{[Op.ne]:'Success'},
            upi_merchant_trans_notification_datetime:{[Op.ne]:null}
          },
          attributes:['upi_merchant_trans_notification_datetime','upi_merchant_trans_execution_retry_count','upi_notification','mandate_type','upi_notification_retry','icic_notify_remark'],
          order: [['id', 'DESC']],
          limit:1,
          raw:true
        },models["debit_tran_reg"]);
        if(res.length==null) return {status:false,msg:"No Data found"};
        const currentDate = moment();
        // console.log("==============================>Executing without PDN ", moment(res[0].upi_merchant_trans_notification_datetime).month(),currentDate.month(), "Checking PDN is of current month");
        const isSameMonth = moment(res[0].upi_merchant_trans_notification_datetime).month() === currentDate.month();
        if(isSameMonth){
          return {
            status: true,
            exe_retry_count: parseInt(res[0]?.upi_merchant_trans_execution_retry_count ?? 0), // Default to 0 if null or undefined
            upi_notification: parseInt(res[0]?.upi_notification ?? 0),
            upi_notification_retry: parseInt(res[0]?.upi_notification_retry ?? 0),
            icic_notify_remark: res[0]?.icic_notify_remark ?? '', // Default to an empty string if null or undefined
            upi_merchant_trans_notification_datetime: res[0]?.upi_merchant_trans_notification_datetime ?? null // Default to null
          };
        }
        return {status:false,msg:"PDN Date is not of current month"};
      }

    export const formatJson = async(params, filePath,processingData) => {
        try {
            let dataArray = [];
            let rejectedArray = [];
            // console.log("processing JSON: " + JSON.stringify(processingData));
            const fileData = await readFileData(filePath,processingData);
    
            const start = async () => {
                let subString = params.file_name.substring(4, 10);
                let currentDate = moment().format('DDMMYY');
                let isSameDayFile = subString === currentDate ? true : false;
                let currentTime = moment().format("HH:mm:ss");
                let isAddOneDay = isSameDayFile === true && currentTime > "15:00:00" && params.user_role === 'COLLECTIONUSER' ? true : false;
                let mandate_start = isAddOneDay === true ? moment(subString, 'DDMMYY').add(1, 'days').format('YYYY-MM-DD') : moment(subString, 'DDMMYY').format('YYYY-MM-DD');
    
                const asyncForEach = async (array, callback) => {
                    for (let index = 0; index < array.length; index++) {
                        await callback(array[index], index, array)
                    }
                };
                await asyncForEach(fileData, async (eachRecord) => {
                    let contractNo = typeof (eachRecord.loan_no) === 'number' ? (eachRecord.loan_no).toString() : eachRecord.loan_no;
                    const recordDetails = await fetchRecordDetails(contractNo, params.company_code,params.mandate_type);
                    const addSeqNoResult = recordDetails[0]?.umrn_no != undefined && recordDetails[0].mandate_type ==='UPI Mandate' ? await addSeqNo(recordDetails[0]?.umrn_no): '';
                    let WPEStatus = false;
                    let withoutPDNRejected = false;
                    let withoutPDNExecutionResult;
                    if(recordDetails.length!==0 && recordDetails[0]?.umrn_no != undefined){
                      if(params?.withoutPDNExe){
                      
                        withoutPDNExecutionResult = await withoutPDNExecution(recordDetails[0]?.umrn_no);
                        if(withoutPDNExecutionResult.status){
                          WPEStatus=true;
                        };
                      }
                    }
                    let data = recordDetails.length > 0 ? recordDetails[0] : null;
                    const isDiffMandate = data !== null ? await checkIsDiffMandate(data.mandate_type) : false;
                    const isDiffSourceSystem = data !== null ? await checkIsDiffSourceSystem(data.source_system) : false;
    
                    let lastTwoDigitOfLoan = eachRecord.loan_no.toString().slice(-2);
                    let timeInUnix = moment().unix();
                    let lastFourDigitOfUnix = timeInUnix.toString().slice(-4);
                    let lastTwoDigitOfUmrnNo = data !== null ? data.umrn_no !== null ? data.umrn_no.toString().slice(-2) : eachRecord.loan_no.toString().slice(-4, -2) : '';
                    let filterFiles = data !== null ? data.source_system === 'FINNONE' ? 'F1 Representation Upload File' : data.source_system === 'BANCS' ? 'Bancs Representation Upload File' : 'Other Representation Upload File' : '';
                    let regex = /^\d+(\.\d{1,2})?$/;
                    let isSpecialChar = regex.test(eachRecord.amount) ? false : true;
                    let isRejectedAmount = eachRecord.amount !== undefined ? isSpecialChar === false ? false : true : true;
                    // let isRejectedAmount = data !== null ? eachRecord.C !== undefined ? isSpecialChar === false ? eachRecord.C > data.mandate_amount ? true : false : true : false : true;
    
                    // let regexForRemark = /^[A-Za-z0-9 ]+$/;
                    // let isSpecialCharInRemark = regexForRemark.test(eachRecord.remark) ? false : true;
    
                    let isSpecialCharInRemark = eachRecord.remark.indexOf(',') != -1 ? true : false;
    
                    let isRemarkAvailable = eachRecord.remark !== undefined ? true : false;
                    let formatedDate =  moment(params.mandate_date,'DD/MM/YYYY').format('DD-MM-YYYY');
                    let sourceSystemUniqueNo = await generateUniqueNumber();
                  console.log("------------ mandate Start::::::::",params.mandate_date);
                    let formattedJson = (data !== null && isRejectedAmount === false && isRemarkAvailable === true && isSpecialChar === false && isSpecialCharInRemark === false && isDiffMandate === false && isDiffSourceSystem === false) ? {
                        'batch_id': params.batchId,
                        'mandate_type': data.mandate_type,
                        'bank_code': data.bank_code,
                        'source_system': data.source_system,
                        'company_code': data.company_code,
                        'loan_no': eachRecord.loan_no,
                        'mandate_start': params.mandate_type === 'UPI Mandate' ? (moment(formatedDate, 'DD-MM-YYYY').isSame(moment().add(1, 'days'), 'day') 
                        ? moment(formatedDate, 'DD-MM-YYYY').format('YYYY-MM-DD') + ' ' + moment().format('HH:mm:ss')  // If it's tomorrow, use the current time
                        : moment(formatedDate, 'DD-MM-YYYY').format('YYYY-MM-DD') + ' 06:00:00')  // If not tomorrow, use 6:00:00
                    : `${mandate_start} 00:00:00`,
                        'account_number': data.account_number,
                        'umrn_no': data.umrn_no,
                        'customer_name': data.customer_name,
                        'mandate_amount': eachRecord.amount,
                        'presentment_mode': 'Representation',
                        'sponsor_bank_ifsc': data.sponsor_bank_ifsc,
                        'ifsc_code': data.ifsc_code,
                        'utility_code': data.utility_code,
                        'account_type': data.account_type,
                        'product_code': data.product_code,
                        'upload_status': 'Success',
                        'record_belongs_from': filterFiles,
                        'source_system_uniq_number': sourceSystemUniqueNo,
                        'payer_va':data.payer_va,
                        "tpls_instrument_ref_no":data.tpls_instrument_ref_no,
                        "micr_code":data.micr_code,
                        "bank_branch_code": data.bank_branch_code,
                        "city_code": data.city_code,
                        "Bank_Branch_Identifier_Code": data.Bank_Branch_Identifier_Code,
                        // 'source_system_uniq_number': lastTwoDigitOfLoan + lastFourDigitOfUnix + lastTwoDigitOfUmrnNo,
                        'presentation_remark': eachRecord.remark,
                        'emi_seq_no':params.mandate_type === 'UPI Mandate'?addSeqNoResult ?? 0 :""
                    } : null;
                    if(params?.withoutPDNExe && WPEStatus){
                      formattedJson.mandate_start=moment().format('YYYY-MM-DD HH:mm:ss');
                      formattedJson.mandate_amount = eachRecord.amount+'.00';
                      formattedJson.upi_notification = withoutPDNExecutionResult.upi_notification;
                      formattedJson.upi_notification_retry = withoutPDNExecutionResult.upi_notification_retry;
                      formattedJson.icic_notify_remark= withoutPDNExecutionResult.icic_notify_remark;
                      formattedJson.upi_merchant_trans_notification_datetime=withoutPDNExecutionResult.upi_merchant_trans_notification_datetime;
                      formattedJson.upi_merchant_trans_execution_retry_count = withoutPDNExecutionResult.exe_retry_count>3?withoutPDNExecutionResult.exe_retry_count+1:4;
                      const exeWithoutPDNResult = await executeWithoutPDNApiTransection(formattedJson);
                      await insertService(formattedJson,'debit_tran_reg');
                      formattedJson = {...formattedJson,...exeWithoutPDNResult.data};
                    }
                    if(params?.withoutPDNExe && !WPEStatus){
                      withoutPDNRejected = true;
                    }
    
                    let isRecordRejected = (data === null || isRejectedAmount === true || isRemarkAvailable === false || isSpecialChar === true || isSpecialCharInRemark === true || isDiffMandate === true || isDiffSourceSystem === true || withoutPDNRejected === true) ? true : false;
                    let rejectionReason = isRemarkAvailable === true ? (isSpecialCharInRemark === false ? (isDiffMandate === false ? (isDiffSourceSystem === false ? (isRejectedAmount === true ? (eachRecord.amount !== undefined ? (isSpecialChar === true ? 'Special character found in Amount' : '') : 'Amount is not available in file') : 'Data Not Found') : 'Found data with incorrect Source System') : 'Found data with incorrect Mandate Type') : 'Comma found in Remark') : 'Remark is not available in file';
                    // let rejectionReason = isRemarkAvailable === true ? (isRejectedAmount === true ? (eachRecord.C !== undefined ? (isSpecialChar === true ? 'Special character found in Amount' : 'Amount is greater than mandate Cap amount') : 'Amount is not available in file') : 'Data Not Found') : 'Remark is not available in file';
                    let rejectedJson = isRecordRejected === true ? {
                        'batch_id': params.batchId,
                        'loan_no': eachRecord.loan_no,
                        'mandate_type': data !== null ? data.mandate_type : null,
                        'bank_code': data !== null ? data.bank_code : null,
                        'source_system': data !== null ? data.source_system : null,
                        'mandate_amount': eachRecord.amount,
                        'mandate_start': mandate_start,
                        'company_code': params.company_code,
                        'presentation_remark': eachRecord.remark === undefined ? '' : eachRecord.remark,
                        'presentment_mode': 'Representation',
                        'upload_status': 'Reject',
                        'upload_reject_reason': rejectionReason
                    } : null;
                    const pushArray = isRecordRejected !== true ? dataArray.push(formattedJson) : rejectedArray.push(rejectedJson);
                });
                let response;
                if(params?.withoutPDNExe){
                  //update query and params
                  await updateData(
                    {
                    update:{
                    upload_status: 'Success',
                    succuss_count: dataArray.length,
                    rejected_count: rejectedArray.length,
                    total_count: dataArray.length + rejectedArray.length,
                    pending_count: 0,
                    file_name: params?.file_name
                  }, 
                  whereQuery: {
                      batch_id: params?.batchId
                    }
                  },models["debit_tran_reg_file_upload_status"]);
                  response = { dataArray: new Array(), rejectedArray: rejectedArray };
                  return response;
                }
                response = { dataArray: dataArray, rejectedArray: rejectedArray };
                return response;
            };
    
            return start().catch((err) => {
                logger.error({ message: `ERROR IN representation formatJson :: ${err}` });
                throw err;
            }); //invokes the whole process
        } catch (err) {
            logger.error({ message: `Error in representation formatJson :: ${err}` });
            throw err;
        }
    }

    export const readFileData = async(filePath,fileData) =>{
        return new Promise((resolve, reject) => {
            try {
                const jsonData = [];
                // console.log(fileData,"fileData");
                for (let i = 0; i < fileData.length; i++) {
                    const line = fileData[i];
                    const arr = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);;
                    const remark = arr[3]?.split('\r');
                    if(arr.length !== 1){
                        const jsonObj = {
                            'sr_no': arr[0],
                            'loan_no':arr[1],
                            'amount': arr[2],
                            'remark': remark[0]
                          };
                          jsonData.push(jsonObj);
                        }
                    }
                    jsonData.shift();
                    resolve(jsonData);
                } catch (err) {
                // Reject the promise if an error occurs
                reject(err);
                }
              
        });
    }

    export const fetchRecordDetails = async(contract_no, company_code,mandate_type) =>{
        try {
          let pastNinetyDaysFromCurrentDate = moment().subtract(90, 'days').format('YYYY-MM-DD') + ' 00:00:00';
          let currentDate = moment().format('YYYY-MM-DD') + ' 23:59:59';
          const whereCondition ={
            loan_no: contract_no,
            company_code: company_code,
            mandate_type: { [Op.ne]:[ 'PDC'] },
            createdAt: {
              [Op.between]: [pastNinetyDaysFromCurrentDate, currentDate]
            }
          }
          if(mandate_type === 'UPI Mandate'){
            whereCondition.mandate_type= 'UPI Mandate' 
          }
          else{
          whereCondition.bank_code= { [Op.notIn]: [''] }
        }


          const recordDetails = await fetchAllData({
            where: whereCondition
            // {
            //   loan_no: contract_no,
            //   company_code: company_code,
            //   mandate_type: { [Op.ne]:[ 'PDC'] },
            //   bank_code: { [Op.notIn]: [''] },
            //   createdAt: {
            //     [Op.between]: [pastNinetyDaysFromCurrentDate, currentDate]
            //   }
            // }
            ,
            order: [
              ["id", "DESC"]
            ],
            limit: 1,
            raw: true
          },models["debit_tran_reg"]);
          console.log("-- recordDetails-->",recordDetails);
          return recordDetails;
        } catch (err) {
          logger.error({ message: `Error in fetchRecordDetails :: ${err}` });
          throw err;
        }
      }

    export const checkIsDiffMandate = async(mandate) =>{
        let isDiffMandate;
        console.log("-------before-- mandate",mandate);

        switch (mandate) {
            case 'AD':
                isDiffMandate = false;
                break;
            case 'NACH':
                isDiffMandate = false;
                break;
            case 'LEG':
                isDiffMandate = false
                break;
            case 'UPI Mandate':
                console.log("--------- mandate",mandate);
                isDiffMandate = false;
                break;
            default:
                isDiffMandate = true
                break;
        }
        console.log("after set ",isDiffMandate);
        return isDiffMandate;
    }
    
    export const checkIsDiffSourceSystem = async(source) =>{
        let isDiffSourceSystem;
        switch (source) {
            case 'FINNONE':
                isDiffSourceSystem = false;
                break;
            case 'BANCS':
                isDiffSourceSystem = false;
                break;
            case 'SAPECC6':
                isDiffSourceSystem = false;
                break;
            default:
                isDiffSourceSystem = true
                break;
        }
        return isDiffSourceSystem;
    }

  export const fileProcessingPresentationBillUpload = async(params,fileData) =>{
      try {
        
          let formattedJson = await formatPresentationBillUploadJson(params,fileData);
          return formattedJson;
      } catch (err) {
          logger.error({ message: `Error in fileProcessing :: ${err}` });
          throw err;
      }
  }

  export const formatPresentationBillUploadJson = async(params,fileData)=>{
    try {
      const tempArr = [];
      const rejTempArr = [];
      const getUtilityCode = await models.leg_utility_master.findAll({ raw : true });
      const sponsorBanks = await models.sponsorBank.findAll({raw:true,attributes: ['bank_code','bank_name', 'mandate_type','company_code']});
      for(const line of fileData){
        if(line.A === 'Sr No' || line.B === 'Contract Number'){
          continue;
        }
        const legUtilityCode = getUtilityCode.find(code => code.loan_no === line.B );
        const sourceSystemLower = line.W.toLowerCase();
        const mandateTypeLower = line.E.toLowerCase();
        const companyCode = line.V === 'TCL' ? QUERY_PARAM.TCFSL : line.V === 'TCHFL'? QUERY_PARAM.TCHFL : null;
        const bankCodeLower = line.U.toLowerCase();
        const sourceSystem = sourceSystemLower.includes("finnone") ? QUERY_PARAM.FINNONE : sourceSystemLower.includes("bancs") ? QUERY_PARAM.BANCS : (sourceSystemLower.includes("sap") || sourceSystemLower.includes("ecc")) ? QUERY_PARAM.SAPECC6 :null;
        const mandateType =mandateTypeLower.includes("enach") ? QUERY_PARAM.ENACH : mandateTypeLower.includes("ach") ? QUERY_PARAM.NACH : (mandateTypeLower.includes("auto debit") || mandateTypeLower.includes("autodebit")) ? QUERY_PARAM.AD : mandateTypeLower.includes("leg") ? QUERY_PARAM.LEG : line.E;
        const getSponsorBank = sponsorBanks.filter(bank => bank.company_code === companyCode && bank.mandate_type === mandateType && bank.bank_name.toLowerCase().includes((line.U?.split(' ')[0] || '').toLowerCase()));
        const bankCode = bankCodeLower.includes("icic") ? QUERY_PARAM.ICICITPSL : bankCodeLower.includes("hdfc") ? QUERY_PARAM.HDFC : bankCodeLower.includes("axis") ? QUERY_PARAM.AXIS : getSponsorBank[0]?.bank_code || line.U ;
        const formattedData = {
          loan_no : line.B,
          customer_name: line.C,
          mandate_amount:parseFloat(line.D).toFixed(2),
          mandate_type:mandateType,
          mandate_start: moment(line.G, DATE_FORMAT.DDMMYYYYNOHHMMA).format(DATE_FORMAT.YYYY_MM_DD),
          product_code: line.H,
          Bank_Branch_Identifier_Code : line.L,
          branch_name : line.M,
          bank_name : line.N,
          ifsc_code: line.O,
          micr_code : line.P,
          account_number : line.Q,
          umrn_no : line.T,
          company_code : companyCode,
          source_system : sourceSystem,
          source_system_uniq_number : line.X,
          bank_code : bankCode,
          batch_id : params.batchId,
          presentment_mode : params.presentation_type,
          record_belongs_from : sourceSystem === QUERY_PARAM.FINNONE ? "F1 ManualBanking" : sourceSystem === QUERY_PARAM.BANCS ? "Bancs ManualBanking" : 'Other ManualBanking',
          utility_code : mandateType === QUERY_PARAM.LEG ? legUtilityCode : UtilityCodes[process.env.NODE_ENV][companyCode]
        } 
        const isDuplicate = await models.debit_tran_reg.findOne({
          where: {
            loan_no: formattedData.loan_no,
            mandate_type: formattedData.mandate_type,
            source_system: formattedData.source_system,
            bank_code: formattedData.bank_code,
            company_code: formattedData.company_code,
            mandate_start: moment(formattedData.mandate_start, DATE_FORMAT.YYYY_MM_DD).format(`${DATE_FORMAT.YYYY_MM_DD} 05:30:00`),
            account_number: formattedData.account_number
          }
        });
        
        if (isDuplicate) {
          console.log('Duplicate record exists');
          formattedData.upload_reject_reason = RES_MSG.RECORD_ALREADY_EXISTS;
          rejTempArr.push(formattedData);
          continue;
        }
        let result = tempArr.some(
          item =>
            item.loan_no === formattedData.loan_no &&
            item.bank_code === formattedData.bank_code &&
            item.account_number === formattedData.account_number
        )
        if(result){
          formattedData.upload_reject_reason = RES_MSG.DUPLICATE_RECORD;
          rejTempArr.push(formattedData)
        }else{
          tempArr.push(formattedData);
        }
      }
      await insetIntoDebitTran(tempArr,rejTempArr,params.batchId);
      return true;
    } catch (error) {
      console.log("Error in formatting data ",error);
    }
  }

  export const insetIntoDebitTran = async (success,failed,batchId)=>{
    try {
      await insertInChunks(success, models.debit_tran_reg);
      await insertInChunks(failed, models.debit_tran_res);
      await updateLogs(batchId);
    } catch (error) {
      console.log("Error in insert Data ",error);
    }
  }

  const insertInChunks = async (data, model) => {
  if (data.length === 0) return;

  const chunkedData = _.chunk(data, 5000);
  await Promise.all(
    chunkedData.map(async (chunk) => {
      try {
        await model.bulkCreate(chunk, { validate: true });
      } catch (error) {
        console.log(`Error in inserting bulk data `, error);
      }
    })
  );
};

 export const updateLogs = async (batchId)=>{
  try {
    const successCount = await countData({where :{batch_id : batchId}},TABLE_NAMES.DEBIT_TRAN_REG);
    const rejectCount = await countData({where :{batch_id : batchId}},TABLE_NAMES.DEBIT_TRAN_RES);
    console.log('Bill Upload Presentation in update logs successCount >>', successCount, 'rejectCount >>', rejectCount)

    const response = await updateData(
      {
      update : {
        total_count: successCount + rejectCount,
        succuss_count: successCount,
        rejected_count: rejectCount,
        pending_count: '0',
        upload_status: S3_FILE_PATH.SUCCESS
      },
      whereQuery: { batch_id: batchId } 
    },
    models[TABLE_NAMES.DEBIT_TRAN_FILE_UPLOAD_STATUS]
    )
    return true
  } catch (error) {
    console.log(' error in updateLogs >>', error)
  }
 };
