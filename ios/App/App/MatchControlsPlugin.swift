import AVFoundation
import Capacitor
import MediaPlayer

@objc(MatchControlsPlugin)
public class MatchControlsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MatchControlsPlugin"
    public let jsName = "MatchControls"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]
    private var listening = false

    @objc func start(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            installCommands()
            apply(call)
            call.resolve()
        } catch {
            call.reject("Não foi possível ativar os controles da tela bloqueada.", nil, error)
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        apply(call)
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        removeCommands()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        call.resolve()
    }

    private func apply(_ call: CAPPluginCall) {
        let remaining = max(0, call.getDouble("remainingMs") ?? 600000) / 1000
        let running = call.getBool("running") ?? false
        let duration = 600.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: call.getString("title") ?? "Pelada dos Sub",
            MPMediaItemPropertyArtist: call.getString("score") ?? "0 × 0",
            MPMediaItemPropertyAlbumTitle: call.getString("subtitle") ?? "Partida",
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: max(0, duration - remaining),
            MPNowPlayingInfoPropertyPlaybackRate: running ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
        ]
        if #available(iOS 13.0, *) {
            MPNowPlayingInfoCenter.default().playbackState = running ? .playing : .paused
        }
    }

    private func installCommands() {
        guard !listening else { return }
        listening = true
        let center = MPRemoteCommandCenter.shared()
        center.previousTrackCommand.isEnabled = true
        center.nextTrackCommand.isEnabled = true
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.previousTrackCommand.addTarget { [weak self] _ in self?.emit("GOAL_HOME"); return .success }
        center.nextTrackCommand.addTarget { [weak self] _ in self?.emit("GOAL_AWAY"); return .success }
        center.playCommand.addTarget { [weak self] _ in self?.emit("HIGHLIGHT"); return .success }
        center.pauseCommand.addTarget { [weak self] _ in self?.emit("UNDO"); return .success }
    }

    private func removeCommands() {
        guard listening else { return }
        listening = false
        let center = MPRemoteCommandCenter.shared()
        center.previousTrackCommand.removeTarget(nil)
        center.nextTrackCommand.removeTarget(nil)
        center.playCommand.removeTarget(nil)
        center.pauseCommand.removeTarget(nil)
    }

    private func emit(_ action: String) {
        notifyListeners("controlAction", data: ["action": action], retainUntilConsumed: true)
    }
}
