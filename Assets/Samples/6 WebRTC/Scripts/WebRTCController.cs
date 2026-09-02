using Meta.XR;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
#if WEBRTC_ENABLED
using SimpleWebRTC;
#endif

namespace QuestCameraKit.WebRTC {
    /// <summary>
    /// パススルーカメラ映像を配信用のパネルに貼り付け、入力に応じて WebRTC 送信を開始するコントローラー。
    /// </summary>
    public class WebRTCController : MonoBehaviour {
        [SerializeField] private PassthroughCameraAccess cameraAccess;
        [SerializeField] private RawImage canvasRawImage;
        [SerializeField] private GameObject connectionGameObject;
        [SerializeField] private bool adaptFovToCustomValue;
        [SerializeField] private float customFovValue;
        [SerializeField] private Camera[] streamingCameras;

#if WEBRTC_ENABLED
        private Texture _cameraTexture;
        private WebRTCConnection _webRTCConnection;

        #region UnityEvent

        private IEnumerator Start() {
            cameraAccess = ResolveCameraAccess(cameraAccess);

            // 参照が欠けたまま待機に入ると永久に待ち続けてしまうため、待機前にまとめて弾く
            if (!TryResolveReferences()) {
                yield break;
            }

            // パススルーカメラは権限確認と初期化に時間がかかるので、映像が流れ始めるまで待つ
            yield return new WaitUntil(() => cameraAccess.IsPlaying);

            _cameraTexture = cameraAccess.GetTexture();
            canvasRawImage.texture = _cameraTexture;
        }

        private void Update() {
            // 初期化が完了する前の入力は無視する（Start が失敗した場合もここで止まる）
            if (_webRTCConnection == null) {
                return;
            }

            if (OVRInput.Get(OVRInput.Button.Start)) {
                _webRTCConnection.StartVideoTransmission();
            }

#if UNITY_EDITOR
            if (Input.GetKeyUp(KeyCode.Space)) {
                _webRTCConnection.StartVideoTransmission();
            }
#endif

            ApplyCustomFov();
        }

        #endregion

        #region Private

        /// <remarks>
        /// UnityEngine.Object は破棄済みでも == null が true になる偽 null のため、?. ではなく == null で判定する。
        /// </remarks>
        private bool TryResolveReferences() {
            if (cameraAccess == null) {
                Debug.LogError("[WebRTCController] PassthroughCameraAccess がシーン内に見つかりません。");
                return false;
            }

            if (canvasRawImage == null) {
                Debug.LogError("[WebRTCController] canvasRawImage が未設定です。");
                return false;
            }

            if (connectionGameObject == null) {
                Debug.LogError("[WebRTCController] connectionGameObject が未設定です。");
                return false;
            }

            _webRTCConnection = connectionGameObject.GetComponent<WebRTCConnection>();
            if (_webRTCConnection == null) {
                Debug.LogError("[WebRTCController] connectionGameObject に WebRTCConnection が付いていません。");
                return false;
            }

            return true;
        }

        /// <summary>
        /// 配信映像とパススルー映像の見え方を揃えるため、配信用カメラの画角を指定値へ合わせる。
        /// </summary>
        private void ApplyCustomFov() {
            if (!adaptFovToCustomValue || streamingCameras == null) {
                return;
            }

            foreach (var streamingCamera in streamingCameras) {
                // 配列に未設定要素が混ざっていても他のカメラの更新を止めない
                if (streamingCamera == null || Mathf.Approximately(streamingCamera.fieldOfView, customFovValue)) {
                    continue;
                }

                streamingCamera.fieldOfView = customFovValue;
            }
        }

        #endregion
#endif

        private static PassthroughCameraAccess ResolveCameraAccess(PassthroughCameraAccess configuredAccess) {
            if (configuredAccess) {
                return configuredAccess;
            }

            return FindAnyObjectByType<PassthroughCameraAccess>(FindObjectsInactive.Include);
        }
    }
}
