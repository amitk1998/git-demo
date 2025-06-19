let Sequelize = require('sequelize');

module.exports = (connection, DataType) => {

	let mergeDebitTransaction = connection.define('mergeDebitTransaction', {
		batch_id: Sequelize.STRING,
		mandate_type: Sequelize.STRING,
		bank_code: Sequelize.STRING,
        company_code:Sequelize.STRING,
		settalement_date: Sequelize.STRING,
		mandate_start_date: Sequelize.STRING,
		mandate_end_date: Sequelize.STRING,
		totalcount: Sequelize.STRING,
		date_time: Sequelize.STRING,
		user_name: Sequelize.STRING,
		user_code: Sequelize.STRING,
		registration_date: Sequelize.STRING,
		search_start: Sequelize.STRING,
		search_end_Date: Sequelize.STRING,
		presentation_type: Sequelize.STRING,
		s3_key: Sequelize.STRING,
		sftp_push_flag: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		}
	},

		{
			classMethods: {},
			freezeTableName: true,
		});
	return mergeDebitTransaction;
};