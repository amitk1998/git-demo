import jwt from "jsonwebtoken";
import { RES_MSG, RES_CODE } from "../constants";


export const tokenValidation = async (req, res, next) => {
    try {
        const token = req.headers['x-access-token']
        if (!token) return res.status(RES_CODE.UNAUTHORIZED).json({ message: RES_MSG.NO_TOKEN });
        const decoded = await jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(RES_CODE.UNAUTHORIZED).json({ message: RES_MSG.INVALID_TOKEN });

    }
}



export const advanceEmiTokenValidator = async (req, res, next) => {
    try {
        const token = req.headers['x-access-token']
        if (!token) return res.status(RES_CODE.UNAUTHORIZED).json({ message: RES_MSG.NO_TOKEN });
        const decoded = await jwt.verify(token, 'LellV+1mdHw0CnZ0Uwjnhg==')
        console.log('decoded>>>>>', decoded)
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(RES_CODE.UNAUTHORIZED).json({ message: RES_MSG.INVALID_TOKEN });

    }
}