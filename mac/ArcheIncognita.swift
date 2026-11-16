import AppKit
import UniformTypeIdentifiers
import WebKit

@MainActor
final class ArcheIncognita: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var page: URL!
    private var stateFile: URL!
    private var lastBackup: URL? {
        get { UserDefaults.standard.string(forKey: "lastBackupPath").map { URL(fileURLWithPath: $0) } }
        set { UserDefaults.standard.set(newValue?.path, forKey: "lastBackupPath") }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let resources = Bundle.main.resourceURL else {
            NSApplication.shared.terminate(nil)
            return
        }
        let web = resources.appendingPathComponent("Web", isDirectory: true)
        page = web.appendingPathComponent("index.html")
        let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        stateFile = applicationSupport.appendingPathComponent("ArcheIncognita", isDirectory: true)
            .appendingPathComponent("map.json")
        #if SMOKE_TEST
        if let testPath = ProcessInfo.processInfo.environment["ARCHE_SMOKE_STATE"] {
            stateFile = URL(fileURLWithPath: testPath)
        }
        #endif

        let controller = WKUserContentController()
        let state = (try? String(contentsOf: stateFile, encoding: .utf8)) ?? ""
        let encoded = try! JSONSerialization.data(withJSONObject: state, options: [.fragmentsAllowed])
        controller.addUserScript(WKUserScript(
            source: "window.archeNativeState = \(String(decoding: encoded, as: UTF8.self));",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        controller.addScriptMessageHandler(self, contentWorld: .page, name: "archeAutosave")
        controller.addScriptMessageHandler(self, contentWorld: .page, name: "archeBackup")

        let config = WKWebViewConfiguration()
        config.userContentController = controller
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1160, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false
        )
        window.title = "ArcheIncognita"
        window.minSize = NSSize(width: 420, height: 380)
        window.contentView = webView
        window.center()
        installMenus()
        webView.loadFileURL(page, allowingReadAccessTo: web)
        #if SMOKE_TEST
        if ProcessInfo.processInfo.environment["ARCHE_SMOKE_STATE"] != nil { return }
        #endif
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func installMenus() {
        let main = NSMenu()
        let app = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About ArcheIncognita", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit ArcheIncognita", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        app.submenu = appMenu
        main.addItem(app)

        let file = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(withTitle: "Save", action: #selector(quickSave), keyEquivalent: "s").target = self
        let saveAs = fileMenu.addItem(withTitle: "Save As…", action: #selector(saveBackup), keyEquivalent: "s")
        saveAs.keyEquivalentModifierMask = [.command, .shift]
        saveAs.target = self
        fileMenu.addItem(withTitle: "Load Backup…", action: #selector(loadBackup), keyEquivalent: "o").target = self
        fileMenu.addItem(.separator())
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        file.submenu = fileMenu
        main.addItem(file)

        let edit = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        for (title, action, key) in [
            ("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"),
            ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")
        ] {
            editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        edit.submenu = editMenu
        main.addItem(edit)
        NSApplication.shared.mainMenu = main
    }

    @objc private func saveBackup() {
        webView.evaluateJavaScript("window.archeSave(false)")
    }

    @objc private func quickSave() {
        webView.evaluateJavaScript("window.archeSave(true)")
    }

    @objc private func loadBackup() {
        webView.evaluateJavaScript("document.getElementById('import-map').click()")
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let isAppPage = navigationAction.request.url?.standardizedFileURL == page.standardizedFileURL
        decisionHandler(isAppPage ? .allow : .cancel)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.standardizedFileURL == page.standardizedFileURL else {
            replyHandler(nil, "Unrecognized page.")
            return
        }
        switch message.name {
        case "archeAutosave":
            guard let text = message.body as? String else {
                replyHandler(nil, "Invalid map.")
                return
            }
            do {
                try FileManager.default.createDirectory(at: stateFile.deletingLastPathComponent(), withIntermediateDirectories: true)
                try Data(text.utf8).write(to: stateFile, options: .atomic)
                replyHandler(true, nil)
            } catch {
                replyHandler(nil, error.localizedDescription)
            }
        case "archeBackup":
            guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
                replyHandler(nil, "Invalid backup request.")
                return
            }
            if action == "quicksave", let contents = body["contents"] as? String, let name = body["name"] as? String {
                if let url = lastBackup,
                   FileManager.default.fileExists(atPath: url.deletingLastPathComponent().path) {
                    do {
                        try Data(contents.utf8).write(to: url, options: .atomic)
                        replyHandler(url.lastPathComponent, nil)
                    } catch {
                        replyHandler(nil, error.localizedDescription)
                    }
                } else {
                    saveFile(name: name, contents: contents, reply: replyHandler)
                }
            } else if action == "save", let contents = body["contents"] as? String, let name = body["name"] as? String {
                saveFile(name: name, contents: contents, reply: replyHandler)
            } else if action == "load" {
                openFile(reply: replyHandler)
            } else {
                replyHandler(nil, "Invalid backup request.")
            }
        default:
            replyHandler(nil, "Unknown request.")
        }
    }

    private func saveFile(name: String, contents: String, reply: @escaping (Any?, String?) -> Void) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = lastBackup?.lastPathComponent ?? name
        if let folder = lastBackup?.deletingLastPathComponent() { panel.directoryURL = folder }
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { reply(false, nil); return }
            do {
                try Data(contents.utf8).write(to: url, options: .atomic)
                self.lastBackup = url
                reply(url.lastPathComponent, nil)
            } catch {
                reply(nil, error.localizedDescription)
            }
        }
    }

    private func openFile(reply: @escaping (Any?, String?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { reply(false, nil); return }
            do {
                reply(try String(contentsOf: url, encoding: .utf8), nil)
            } catch {
                reply(nil, error.localizedDescription)
            }
        }
    }
}

@main
struct Main {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = ArcheIncognita()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        app.run()
    }
}
