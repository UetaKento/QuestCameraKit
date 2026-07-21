// SimpleWebRTC 用の LAN シグナリングサーバー（待ち合わせサーバー）
//
// このサーバーを映像そのものは通りません。Quest と PC が「お互いの居場所」を
// 教え合うためだけに使い、接続が成立した後の映像は端末同士で直接やり取りされます。
//
// SimpleWebRTC のメッセージ形式は JSON ではなく「|」区切りのテキストです。
//   種別|送信元PeerId|宛先PeerId|本文|接続数|映像送信側かどうか
//
// 中継の規則は SimpleWebRTC 公式のサーバー実装
// （Packages/com.firedragongamestudio.simplewebrtc/Runtime/SignalServerCode.txt）に合わせ、
// 「送信元以外の全員へそのまま転送」とします。宛先の絞り込みは受信側の WebRTCManager が
// ReceiverPeerId を見て行うため、サーバーが振り分ける必要はありません。
// 送信元に返さないのは、自分自身と接続しようとして失敗するのを防ぐためです。
//
// このファイルが公式のサンプルに足しているのは、実運用で必要になる次の3点だけです。
//   - 起動時に設定すべき ws:// アドレスを表示する
//   - どの種別のメッセージが誰から誰へ流れたかをログに出す（切り分け用）
//   - ブラウザで開いて稼働確認できるようにする

const http = require("http");
const os = require("os");

// node_modules はリポジトリに含めないため、別の PC に持ち込んだ直後は必ずここで失敗する。
// Node の既定エラーは原因が読み取りにくいので、何をすれば直るかを明示する。
let WebSocketServer;
try {
    ({ WebSocketServer } = require("ws"));
} catch {
    console.error("");
    console.error("【起動できません】必要な部品 'ws' がまだインストールされていません。");
    console.error("");
    console.error("次の2行を実行してください（この PC では1回だけで済みます）:");
    console.error(`    cd ${__dirname}`);
    console.error("    npm install");
    console.error("");
    process.exit(1);
}

const PORT = Number(process.env.PORT) || 8080;

/** 接続中のソケット -> PeerId。最初に届いたメッセージの「送信元」から学習する。 */
const peerIds = new Map();

const server = http.createServer((_req, res) => {
    // ブラウザで開いたときに「サーバーが生きている」ことを目視確認できるようにする
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`SimpleWebRTC signaling server: 稼働中\n接続中のピア: ${describePeers()}\n`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, req) => {
    console.log(`[${stamp()}] + 接続: ${req.socket.remoteAddress}  （現在 ${wss.clients.size} 台）`);

    socket.on("message", (raw) => {
        const text = raw.toString();
        const parts = text.split("|");
        const messageType = parts[0] || "?";
        const senderPeerId = parts[1];
        const receiverPeerId = parts[2];

        if (senderPeerId && peerIds.get(socket) !== senderPeerId) {
            peerIds.set(socket, senderPeerId);
            console.log(`[${stamp()}]   PeerId を確認: ${senderPeerId}`);
        }

        // 送信元以外の全員へそのまま転送する（宛先の判定は受信側が行う）
        const targets = [...wss.clients].filter(
            (client) => client !== socket && client.readyState === client.OPEN
        );

        for (const target of targets) {
            target.send(text);
        }

        console.log(
            `[${stamp()}] > ${messageType}  ${senderPeerId || "?"} -> ${receiverPeerId || "?"}  （中継 ${targets.length} 件）`
        );

        if (targets.length === 0) {
            console.log(`[${stamp()}]   ! 中継先がありません。もう一方の端末がまだ接続していない可能性があります`);
        }
    });

    socket.on("close", () => {
        const id = peerIds.get(socket) || "(不明)";
        peerIds.delete(socket);
        console.log(`[${stamp()}] - 切断: ${id}  （残り ${wss.clients.size} 台）`);
    });

    socket.on("error", (error) => {
        console.error(`[${stamp()}] ! エラー: ${error.message}`);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log("=".repeat(60));
    console.log("SimpleWebRTC シグナリングサーバーを起動しました");
    console.log("Unity のシーンに設定するアドレス（どれか1つ）:");
    for (const address of listLanAddresses()) {
        console.log(`    ws://${address}:${PORT}`);
    }
    console.log("停止するには Ctrl + C");
    console.log("=".repeat(60));
});

function describePeers() {
    const names = [...wss.clients].map((client) => peerIds.get(client) || "(不明)");
    return names.length > 0 ? names.join(", ") : "(なし)";
}

function listLanAddresses() {
    const addresses = [];
    for (const entries of Object.values(os.networkInterfaces())) {
        for (const entry of entries || []) {
            if (entry.family === "IPv4" && !entry.internal) {
                addresses.push(entry.address);
            }
        }
    }
    return addresses.length > 0 ? addresses : ["<PCのIPアドレス>"];
}

function stamp() {
    return new Date().toTimeString().substring(0, 8);
}
