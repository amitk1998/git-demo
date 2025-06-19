let Sequelize = require('sequelize');

module.exports = function(connection, DataType){

	let leg_utility_master = connection.define('leg_utility_master', {
		id: {
			type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
		},
		
		loan_no: Sequelize.STRING,
		utility_code: Sequelize.STRING
	},

	{
		classMethods: {

		},
    freezeTableName: true,
});

	return leg_utility_master;
};

