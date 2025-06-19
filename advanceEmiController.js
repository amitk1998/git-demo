import { logger } from "../modules/filelogger";
import moment from "moment-timezone";
import { RES_MSG, RES_CODE, LOGGER_CODES, TABLE_NAMES } from "../constants";
import { ResponseHandler, MastersResponseBody } from "../utils";
import {v4 as uuidv4} from 'uuid'
import AdvanceEmiService from "../services/advanceEmiService";
import { fetchWithCountService, insertService, updateDatas } from "../utils/crud";

const responseHandler = new ResponseHandler()
const advanceEmiServiceObj = new AdvanceEmiService()

const moduleName = 'Debit Transaction'
const subModuleName = 'Advance Emi'
const functionName = 'advanceEmiController'

export const advanceEmiController = async (req, res) => {

    const timestamp = moment().toISOString()
    const requestId = uuidv4()

    try {
        const {body} = req;
        const {user_id} = req.headers;

        logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Enter In Advance Emi Controller : ${JSON.stringify(body)} | ${functionName} | ${LOGGER_CODES.INFO}`);
        
        const params = body.bulkEmiData

        if(!user_id) {
            return responseHandler.MasterHandleBody( 
                new MastersResponseBody(RES_CODE[400], RES_MSG.BAD_REQUEST, 'Request headers are missing. Please input correct headers'),
                res
            )
        }
        
        const user = await fetchWithCountService({where: {user_code: user_id}}, TABLE_NAMES.USER)

        if(!user || !user.count || !user.rows.length) {
            return responseHandler.MasterHandleBody( 
                new MastersResponseBody(RES_CODE[400], RES_MSG.BAD_REQUEST, 'User ID does not exist'),
                res
            )
        }

        const saveLogParams = {
            api_module: 'ADVANCE_EMI',
            client_ip: req.socket.remoteAddress,
            headers: JSON.stringify(req.headers),
            request_body: JSON.stringify({...req.body, user: user_id , noOfRecords: req.body?.bulkEmiData?.length, user: user_id})
        }

        console.log('saveLogParams>>>>>>>>>>>>>', saveLogParams)
        
        const saveLog = await insertService(saveLogParams, TABLE_NAMES.API_REQ_RES_LOGS)

        const emiServiceResponse = await advanceEmiServiceObj.advanceEmiService(params, saveLog.id, user.rows[0].user_name)

        console.log("emiServiceResponse>>>>>>>>", emiServiceResponse)

        const updatedReqResLogs = await updateDatas({response_body: JSON.stringify(emiServiceResponse)}, {id: saveLog.id}, TABLE_NAMES.API_REQ_RES_LOGS)

        logger.info(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | ADVANCE EMI RESPONSE : ${JSON.stringify(RES_MSG.ACKNOWLEDGED)} | ${functionName} | ${LOGGER_CODES.SUCCESS}`);
        return responseHandler.MasterHandleBody(
            new MastersResponseBody(RES_CODE.SUCCESS, RES_MSG.ACKNOWLEDGED, emiServiceResponse),
            res
        )

    } catch (error) {
        console.log('ex>>>', error)
        logger.error(`${timestamp} | ${requestId} | ${moduleName} | ${subModuleName} | Error In Advance EMI Controller : ${error} | ${functionName} | ${LOGGER_CODES.ERROR}`);
        return responseHandler.MasterHandleBody( 
            new MastersResponseBody(RES_CODE[500], RES_MSG.INTERNAL_SERVER_ERROR, error.message),
            res
        )
    }
}