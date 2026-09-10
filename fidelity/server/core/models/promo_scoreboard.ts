import { DataTypes, Model, Optional } from 'sequelize';
import type { TracciatoReport } from '../../../lib/types';
import { sequelize } from '../db/SequelizeConnector';

export interface PromoScoreboardAttributes {
  id_promo: string;
  report: TracciatoReport;
  computedat: Date;
}

type PromoScoreboardCreationAttributes = Optional<PromoScoreboardAttributes, 'computedat'>;

class PromoScoreboardClass extends Model<PromoScoreboardAttributes, PromoScoreboardCreationAttributes> implements PromoScoreboardAttributes {
  declare id_promo: string;
  declare report: TracciatoReport;
  declare computedat: Date;
}

const PromoScoreboard = sequelize.define<PromoScoreboardClass>('promo_scoreboard', {
  id_promo: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
    unique: true,
  },
  report: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  computedat: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
  tableName: 'promo_scoreboard',
  freezeTableName: true,
});

export { PromoScoreboard };
