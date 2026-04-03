require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const db = new Database('ranking.db');

// 1. Configuración de la Base de Datos
db.prepare('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, points INTEGER)').run();

// 2. Inicialización del Bot
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

let rankingMessage = null;

// 3. Función para generar el diseño del Ranking
function generarRankingEmbed() {
    const top10 = db.prepare('SELECT * FROM users ORDER BY points DESC LIMIT 10').all();
    
    return new EmbedBuilder()
        .setTitle('🏆 TOP APORTADORES - CLAN PEKO')
        .setColor('#0099ff')
        .setDescription(
            top10.length > 0 
            ? top10.map((u, i) => `**#${i + 1}** | \`${u.username}\` — **${u.points.toLocaleString()}** pts`).join('\n')
            : 'Esperando los primeros aportes del clan...'
        )
        .setFooter({ text: 'Actualizado en vivo • MineLatino Network' })
        .setTimestamp();
}

// 4. Lógica para detectar puntos
client.on('messageCreate', async (message) => {
    if (message.embeds.length > 0) {
        const embed = message.embeds[0];
        const texto = embed.description || "";

        // Regex para detectar nombre y puntos
        const regex = /!\s+(?:\()?([\w]+)(?:\)?)\s+ha conseguido\s+([\d.]+)/;
        const match = texto.match(regex);

        if (match) {
            const username = match[1];
            const points = parseInt(match[2].replace(/\./g, ''));

            db.prepare(`
                INSERT INTO users (username, points) 
                VALUES (?, ?) 
                ON CONFLICT(username) 
                DO UPDATE SET points = points + ?
            `).run(username, points, points);

            console.log(`✅ Registrado: ${username} +${points} pts`);

            if (rankingMessage) {
                try {
                    await rankingMessage.edit({ embeds: [generarRankingEmbed()] });
                } catch (err) {
                    console.error("Error al editar:", err.message);
                }
            }
        }
    }
});

// 5. Configuración al encender
client.once('ready', async () => {
    console.log(`🤖 Bot conectado como: ${client.user.tag}`);
    
    try {
        const channel = await client.channels.fetch(process.env.CANAL_RANKING_ID);
        const messages = await channel.messages.fetch({ limit: 20 });
        rankingMessage = messages.find(m => m.author.id === client.user.id);

        if (!rankingMessage) {
            rankingMessage = await channel.send({ embeds: [generarRankingEmbed()] });
        } else {
            await rankingMessage.edit({ embeds: [generarRankingEmbed()] });
        }
    } catch (error) {
        console.error("❌ Error en el canal:", error.message);
    }
});

// 6. Login
client.login(process.env.TOKEN);