# WebRTC 待ち合わせサーバー（シグナリングサーバー）

`Assets/Samples/6 WebRTC` のサンプルを **LAN 内だけ**で動かすための小さなサーバーです。

## これは何をするもの？

Quest と PC が「お互いの居場所」を教え合うための仲介役です。
**映像そのものはこのサーバーを通りません。** 待ち合わせが済んだ後は、Quest と PC が直接つながって映像をやり取りします。

そのため、このサーバーが多少非力でも映像の品質には影響しません。

## 使い方

### 1. 初回だけ：部品を入れる

```powershell
cd d:\gitProject\QuestCameraKit\Tools\WebRTC-SignalingServer
npm install
```

### 2. 起動する

```powershell
npm start
```

起動すると、Unity に設定すべきアドレスが画面に表示されます。

```
============================================================
SimpleWebRTC シグナリングサーバーを起動しました
Unity のシーンに設定するアドレス（どれか1つ）:
    ws://192.168.1.218:8080
停止するには Ctrl + C
============================================================
```

**このウィンドウは開いたままにしておいてください。** 閉じると接続できなくなります。
Quest と PC のやり取りがすべてログに流れるので、うまくいかないときの切り分けに使えます。

### 3. 動いているか確かめる

PC のブラウザで `http://192.168.1.218:8080` を開いて「稼働中」と出れば成功です。

## 事前に必要な設定

- **Windows ファイアウォールでポート 8080 の受信を許可する**（下記コマンドを管理者権限の PowerShell で1回だけ実行）

  ```powershell
  New-NetFirewallRule -DisplayName "WebRTC Signaling 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
  ```

- **Quest と PC を同じネットワークにつなぐ**（`192.168.1.x` どうしになっていること）
- **VPN を切る**。VPN が有効だと通信が外へ逃げて LAN 内で出会えなくなることがあります

## Unity 側の設定

両方のシーンの `Client-STUNConnection` に対して：

| 項目 | 設定値 |
|---|---|
| WebSocketServerAddress | `ws://192.168.1.218:8080`（`wss` ではなく `ws`） |
| StunServerAddress | **空欄**（LAN 内では不要） |

## 技術メモ

SimpleWebRTC のやり取りは JSON ではなく **`|` 区切りのテキスト**です。

```
種別|送信元PeerId|宛先PeerId|本文|接続数|映像送信側かどうか
```

種別は `NEWPEER` / `NEWPEERACK` / `OFFER` / `ANSWER` / `CANDIDATE` / `DATA` / `DISPOSE` / `COMPLETE`。

中継の規則は SimpleWebRTC 公式のサーバー実装
（`Packages/com.firedragongamestudio.simplewebrtc/Runtime/SignalServerCode.txt`）と同じです。

- 受け取ったメッセージを**送信元以外の全員へそのまま転送する**
- **送信元には返さない**（返すと自分自身と接続しようとして失敗するため）

宛先の絞り込みはサーバーではなく受信側が行います。`WebRTCManager.cs` の `OFFER` / `ANSWER` /
`CANDIDATE` などの処理が `ReceiverPeerId` と自分の PeerId を照合し、自分宛てでなければ無視します。

公式実装との違いは、実際の切り分け作業で役立つ次の3点だけです。

- 起動時に設定すべき `ws://` アドレスを表示する
- どの種別のメッセージが誰から誰へ流れたかをログに出す
- ブラウザで開いて稼働確認できるようにする
