let Sequelize = require('sequelize');

module.exports = function (connection, DataType) {

	let debitTransactionReversalResponse = connection.define('debitTransactionReversalResponse', {
		batch_id: Sequelize.STRING,
		upload_date_time: Sequelize.STRING,
		user_name: Sequelize.STRING,
		user_code: Sequelize.STRING,
		upload_status: Sequelize.STRING,
		total_count: Sequelize.STRING,
		succuss_count: Sequelize.STRING,
		rejected_count: Sequelize.STRING,
		pending_count: Sequelize.STRING,
		file_name: Sequelize.STRING,
		presentation_type: Sequelize.STRING,
		bank_code: Sequelize.STRING,
		mandate_type: Sequelize.STRING,
		company_code: Sequelize.STRING,
		demerge_response_FINNONE: Sequelize.TEXT,
		demerge_response_BANCS: Sequelize.TEXT,
		demerge_response_SAPECC6: Sequelize.TEXT,
		demerge_response_SAP:Sequelize.TEXT,
		demerge_response_MANUAL: Sequelize.TEXT,
	},

		{
			classMethods: {

			},
			freezeTableName: true,
		});

	return debitTransactionReversalResponse;
};