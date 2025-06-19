import Joi from 'joi'

// COMMON SECTION START HERE
const _panRef = Joi.ref('productInfoSchema.pan')

const productInfoSchema = {
  channelId: Joi.string().required(),
  customertype: Joi.string().required(),
  mobileNumber: {
    countryCode: Joi.string().required().min(2).max(5),
    nationalNumber: Joi.string().required().min(10).max(10)
  },
  branchId: Joi.string().required(),
  accountType: Joi.string().required(),
  productName: Joi.string().required(),
  productType: Joi.string().required(),
  schemeCode: Joi.string().required(),
  pan: Joi.string().allow('').min(10).max(10),
  labelCode: Joi.string().required()
}

const agentSchema = {
  accountNumber: Joi.string().required(),
  branchId: Joi.string().required(),
  agentId: Joi.string().required()
}
// console.log("TESTTTTTTT:::::::", Joi.boolean().valid(true))
const accountNominationSchema = {
  isNomineeMinor: Joi.boolean().required(),
  guardianName: Joi.object().when('isNomineeMinor', { is: Joi.boolean().valid(true), then: Joi.required(), otherwise: Joi.optional().allow('') }),
  guardianRelationshipWithNominee: Joi.string().when('isNomineeMinor', { is: Joi.boolean().valid(true), then: Joi.required(), otherwise: Joi.optional().allow('') }),
  guardianAddress: Joi.object().when('isNomineeMinor', { is: Joi.boolean().valid(true), then: Joi.required(), otherwise: Joi.optional().allow('') })
}

const commonInfoSchema = {
  initialFundingAmt: Joi.any().required(),
  accountNomination: Joi.object().keys(accountNominationSchema).unknown(true)
}


const savingsAcSchema = {
  // 
  digitalForm60: Joi.object().when(_panRef, {
    is: Joi.not().empty(), then: Joi.optional(), otherwise: Joi.required()
  }).unknown(true)
}

const additionalInfoSchema = {
  savingAccountInformation: Joi.object().keys(savingsAcSchema).required().unknown(true),
  commonInformation: Joi.object().keys(commonInfoSchema).unknown(true)
}

// applicationReferenceId = '', commonInformation = {}, savingAccountInformation = {},
//         currentAccountInformation = {}, latitude = '', longitude = ''
// COMMON SECTION ENDS HERE

// INITIATE SCHEMA
const ProductAllocationSchema = Joi.object().keys({
  data: Joi.object({
    uniqueReferenceId: Joi.string().trim().required().min(12).max(20),
    productInformation: Joi.object().keys(productInfoSchema).required(),
    additionalInfo: Joi.object().keys(additionalInfoSchema).required().unknown(true),
    configurationInfo: Joi.object().required(),
    kycInformation: Joi.object().required(),
    constantInfo: Joi.object().required(),
    agent: Joi.object().keys(agentSchema).required()
  }).required()
}).unknown(true)

const HeaderSchema = Joi.object().keys({
  'x-fapi-client-id': Joi.string().trim().required().max(12),
  'x-fapi-client-secret': Joi.string().trim().required().max(12)
}).unknown(true)

// ProductInformation

export { HeaderSchema, ProductAllocationSchema }
