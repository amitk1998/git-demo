let Sequelize = require('sequelize');

module.exports = function (connection, DataType) {

	let debit_tran_reg_file_upload_status = connection.define('debit_tran_reg_file_upload_status', {
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
		module_name: Sequelize.STRING,
		isApprove: Sequelize.STRING,
		isReject: Sequelize.STRING,
		source_system: Sequelize.STRING,
		company_code: Sequelize.STRING,
		mandate_type: Sequelize.STRING
	},

		{
			classMethods: {},
			freezeTableName: true,
		});

	return debit_tran_reg_file_upload_status;
};