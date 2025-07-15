import config from "config.json";
import type { Client, Message } from "discord.js";
import { DataTypes, Model, Op, type CreationOptional, type InferAttributes, type InferCreationAttributes } from "sequelize";
import type { CmdData, Ctx } from "~/util/base"

const regex = new RegExp(
    '(?:([0-9]{1,2}d))?(?:([0-9]{1,2}h))?(?:([0-9]{1,2}m))?'
);

const data: CmdData = {
    name: 'memo',
};

class Memos extends Model<InferAttributes<Memos>, InferCreationAttributes<Memos>> {
    declare id: CreationOptional<number>;
    declare owner: string;
    declare text: string;
    declare timeout: number;
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    const res = regex.exec(args[0]);

    if (!res) {
        await message.reply(config.memos.invalid_timestamp);
        return;
    }

    try {
        const days = parseInt(res[1] ?? 0);
        const hours = parseInt(res[2] ?? 0) + days * 24;
        const minutes = parseInt(res[3] ?? 0) + hours * 60;
        
        const totalTime = Date.now() + minutes * 60 * 1000;

        Memos.create({
            owner: message.author.id,
            text: args.slice(1).join(' '),
            timeout: totalTime,
        });

        await message.reply(config.memos.success
            .replaceAll('$DAYS', res[1] ?? 0)
            .replaceAll('$HOURS', res[2] ?? 0)
            .replaceAll('$MINUTES', res[3] ?? 0)
        );
    } catch (error) {
        await message.reply(config.memos.bad_numbers);
        return;
    }
}

async function tickMinute(client: Client) {
    const now = Date.now();

    const results = await Memos.findAll({
        where: { 
            timeout: {
                [Op.lt]: now 
            }
        }
    });

    results.forEach(async memo => {
        const user = await client.users.fetch(memo.owner);
        user?.send(config.memos.reminder.replaceAll('$TEXT', memo.text));

        memo.destroy();
    });
}

async function setup(ctx: Ctx) {
    Memos.init(
        {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
            },
            owner: DataTypes.STRING,
            text: DataTypes.TEXT,
            timeout: DataTypes.INTEGER.UNSIGNED,
        },
        { sequelize: ctx.sql }
    );

    Memos.sync();
    setInterval(async () => tickMinute(ctx.client), 60 * 1000);
}

export default {
    data,
    execute,
    setup,
}