var Sequelize = require('sequelize');

module.exports = function(connection, DataType){

	var sponsorBank = connection.define('sponsorBank', {
		bank_code: { type: Sequelize.STRING(50),  unique: 'compositeIndex' },
		bank_name: Sequelize.STRING,
		mandate_type:  { type: Sequelize.STRING(50),  unique: 'compositeIndex' },
		company_code:{ type: Sequelize.STRING(50),  unique: 'compositeIndex' },
		bank_identifier: Sequelize.STRING,
		sponsor_bank_id: Sequelize.STRING,
		gl_code:Sequelize.STRING,
		merchant_id:Sequelize.STRING,
		token_id: Sequelize.STRING,
		debit_card_emandate_id: Sequelize.STRING,
		item_id: Sequelize.STRING,
		f1_picklist_bank_name:Sequelize.STRING,
		login_id: Sequelize.STRING,
		service_provider_name: Sequelize.STRING,
		service_provider_utility_code: Sequelize.STRING,
		partner_entity_email: Sequelize.STRING,
		bank_id: Sequelize.STRING,
		amount_to_pay: Sequelize.STRING,
		bancs_mirror_account: Sequelize.STRING,
		isActive: Sequelize.BOOLEAN,
		rptConsolidateActive: Sequelize.BOOLEAN
	},

	{
		classMethods: {
			

		},
		indexes: [ {fields: ['bank_code', 'mandate_type','company_code'] } ],
    freezeTableName: true,
});

	return sponsorBank;
};


