import { fetchWithCountService, insertService, updateDatas } from "../utils/crud"
import { TABLE_NAMES, RES_CODE } from "../constants"
import { Op, Sequelize } from "sequelize"
import moment from "moment-timezone"

export default class AdvanceEmiService {

    caseStatus = {
        DUPLICATE: {status: "Duplicate Case", errorCode: 'ERR001'},
        NOT_AVAILABLE: {status: "Case Not Available In System", errorCode: 'ERR002'},
        ALREADY_MERGED: {status: 'Case is already merged', errorCode: 'ERR003'},
        PROCESSED: {status: 'Case processed successfully, removed from picklist', errorCode: 'ERR004'},
        UPI_CASE_PROCESSED: {status: "UPI Case is already processed", errorCode: 'ERR005'}
    }

    advanceEmiService = async (__params, __batchId, __username) => {
        try {
            
            console.log(":::::::::::::::::ENTER IN ADVANCE-EMI SERVICE:::::::::::::::::", __params)

            let responses = []

                
            for(const item of __params) {
                
                item.batch_id = __batchId
                item.emi_due_date = this.dtDateFormat(item.emi_due_date)

                // check for duplicate records in advance_emi table
                const duplicateAdvanceEmiResponse = await this.checkForDuplicateRecords({ loan_number: item.loan_number, tcl_txn_id: item.tcl_txn_id, 
                    amount: item.amount, 
                    [Op.and]: Sequelize.where(
                        Sequelize.fn('DATE', Sequelize.col('emi_due_date')),'=', item.emi_due_date
                    )}, TABLE_NAMES.ADVANCE_EMI, [['id', 'desc']])

                console.log('duplicateAdvanceEmiResponse>>>>', duplicateAdvanceEmiResponse)

                const data = await insertService(item, TABLE_NAMES.ADVANCE_EMI)

                // check if case is present in debit_tran_reg table
                const debitTranRejData = await this.checkForDuplicateRecords({
                    loan_no: item.loan_number,
                    mandate_amount: item.amount,
                    [Op.and]: Sequelize.where(
                        Sequelize.fn('DATE', Sequelize.col('mandate_start')),'=',item.emi_due_date
                    )}, TABLE_NAMES.DEBIT_TRAN_REG, [['id', 'desc']])

                console.log("duplicateData>>>>", debitTranRejData)
                
                
                if(debitTranRejData.status === RES_CODE[404]) {
                    await this.updateCaseStatus(data.id, this.caseStatus.NOT_AVAILABLE)
                    item.status = this.caseStatus.NOT_AVAILABLE?.status
                    responses.push(item)
                    continue;
                }
                
                const debitTranRejCase = debitTranRejData.record[0]
                /** CHECK FOR UPI mandate_type CASES */
                if(debitTranRejCase.mandate_type.toUpperCase() === 'UPI MANDATE') {

                    const upiResponse = await this.processUPIRecrods(item, debitTranRejCase, responses, __username, data.id)
                    continue
                } else {

                    /**
                     * CASE 1 and CASE 2 are for NACH and ENACH mandate-type
                     * 
                     * CASE 1:
                     * if cases are already merged i.e if merge_batch_id !== null then push to the response arrays
                    */

                   const isAlreadyMerged = debitTranRejCase?.merge_batch_id ?? null
                   const mergeFlag = debitTranRejCase?.merge_flag
                   
                   console.log('isAlreadyMerged, mergeFlag>>>>>', isAlreadyMerged, mergeFlag)
                   
                   if(isAlreadyMerged && mergeFlag && isAlreadyMerged !== null && isAlreadyMerged !== '' && isAlreadyMerged !== ' ') {           
                       await this.updateCaseStatus(data.id, this.caseStatus.ALREADY_MERGED)
                       item.status = this.caseStatus.ALREADY_MERGED?.status
                       responses.push(item)
                       continue;
                       
                    } else {
                        /** 
                         * CASE 2:
                         * if cases are not merged and paid via advance-emi then set isActiveForMerge = false. 
                         * So they won't be picked in the current month picklist
                        */ 
                       const updatedData = await updateDatas({isActiveForMerge: false}, {
                           loan_no: item.loan_number, 
                           mandate_amount: item.amount,
                           [Op.and]: Sequelize.where( Sequelize.fn('DATE', Sequelize.col('mandate_start')),'=',item.emi_due_date)
                        }, TABLE_NAMES.DEBIT_TRAN_REG)
                        
                        console.log('updatedData>>>>>>>>>>>', updatedData)
                        if(updatedData[0] == 1) {
                            item.status = this.caseStatus.PROCESSED?.status
                            await this.updateCaseStatus(data.id, this.caseStatus.PROCESSED)
                        }
                        responses.push(item)
                    }
                    
                }
            }

            return {
                responses
            }

        } catch (error) {
            console.log("ex>>>>", error)
            throw error
        }
    }

    checkForDuplicateRecords = async (_body, _tablename, order = null) => {
        try {

            let params = {
                queryParams: {
                    where: _body
                },
                tablename: _tablename
            }

            if(order) {
                params.queryParams.order = order
            }

            const duplicateData = await fetchWithCountService(params.queryParams, params.tablename)

            if(!duplicateData.count && !duplicateData.rows.length) {
                return {
                    message: `No duplicate record found in ${_tablename}`,
                    status: 404
                }
            }

            return {
                message: `Duplicate record in ${_tablename}`,
                status: 500,
                record: duplicateData.rows
            }

        } catch (error) {
            console.log('ex>>>', error)
            throw error
        }
    } 

    updateCaseStatus = async (id, caseStatus) => {
        try {
            console.log("CaseStatus>>>>>>>>", caseStatus)
            const updatedData = await updateDatas({status: caseStatus?.status, status_code: caseStatus?.errorCode}, {id: id}, TABLE_NAMES.ADVANCE_EMI)

            console.log(`updatedData>>>> ${updatedData}`)

            if(updatedData[0] == 1) {
                console.log(`Status updated as:::${JSON.stringify(caseStatus)}>>>>`)
            } 
        } catch (error) {
            console.log('ex>>>', error)
            throw error
        }
    }

    dtDateFormat = (date) => {
        return moment(date, 'DD-MM-YYYY').format('YYYY-MM-DD')
    }

    processUPIRecrods = async (reqRecord, upiCase, responseBody, username, newCaseId) => {
        try {
            // if response_status: '00' then its a success case and skip to the next record
                if(upiCase.response_status == "00") {

                    console.log('UPI Case already executed.')
                    const updatedData = await this.updateCaseStatus(newCaseId, this.caseStatus.UPI_CASE_PROCESSED) 
                    reqRecord.status = this.caseStatus.UPI_CASE_PROCESSED?.status
                    responseBody.push(reqRecord)

                } else {
                    // if response_status !== '00' then update the columns

                    console.log('UPI case removed from picklist')
                    const updatedData = await updateDatas({
                        upi_merchant_trans_execution_status: 'SUCCESS',
                        upi_merchant_trans_execution_remark: 'Success',
                        upi_merchant_trans_execution_time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        upi_merchant_trans_execution_response: 'manual Payment',
                        upi_merchant_trans_execution_id: 'manual Payment',
                        response_status:"00",
                        response_rejection_reason:'APPROVED OR COMPLETED SUCCESSFULLY',
                        upi_merchant_trans_execution_bank_rrn: 'manual Payment',
                        excl_file_uploaded_by: username,
                        excl_file_flag: 1
                    }, {

                        mandate_type: upiCase.mandate_type,
                        mandate_start: upiCase.mandate_start,
                        loan_no: upiCase.loan_no,
                        mandate_amount: parseFloat(upiCase.mandate_amount).toFixed(2)

                    }, TABLE_NAMES.DEBIT_TRAN_REG)

                    if(updatedData[0] == 1) {
                        await this.updateCaseStatus(newCaseId, this.caseStatus.PROCESSED)
                        reqRecord.status = this.caseStatus.PROCESSED?.status
                        responseBody.push(reqRecord)
                    }
                }

        } catch (error) {
            console.log('ERROR IN UPI RECORDS', error)
            throw error
        }
    }
 
}



