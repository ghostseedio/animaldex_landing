// Records the iOS behaviour director's timeline, the fixture the web port is
// held to (src/lib/talking-models-behaviour.test.ts). Built against the app's
// own file, unchanged:
//
//   git -C <AnimalDex> show main:AnimalDex/Views/AnimalTalkingBehaviour.swift > AnimalTalkingBehaviour.swift
//   swiftc -O AnimalTalkingBehaviour.swift ios-behaviour-timeline.swift -o timeline   (rename to main.swift first)
//   ./timeline ~/animaldex-talking-models/assets koala red-fox giant-oceanic-manta-ray \
//       ring-tailed-lemur ocellaris-clownfish > ios-behaviour-timeline.json
//
// then each animal's `behaviour` section is copied in beside its timeline.
import Foundation

struct RigFile: Decodable {
    let behaviour: AnimalTalkingBehaviour?
    let max_open_degrees: Double
    let eyes: [[Double]]?
    let nose: [Double]?
}

func r(_ v: Float) -> Double { (Double(v) * 1e6).rounded() / 1e6 }
func flat(_ p: AnimalBehaviourPose) -> [Double] {
    [p.mouth, p.lid, p.pitch, p.yaw, p.roll, p.lift, p.nose, p.tail, p.sway, p.stretch].map(r)
}
let assets = CommandLine.arguments[1]
let slugs = Array(CommandLine.arguments.dropFirst(2))
var out: [String: Any] = [:]

// The generator itself.
var rng = AnimalBehaviourRandom(seed: AnimalBehaviourRandom.seed(for: "red-fox"))
var nexts: [String] = []
for _ in 0..<5 { nexts.append(String(rng.next())) }
var units: [Double] = []
for _ in 0..<5 { units.append(rng.unit()) }
out["random"] = ["seed": String(AnimalBehaviourRandom.seed(for: "red-fox")), "next": nexts, "unit": units]

var animals: [[String: Any]] = []
for slug in slugs {
    let data = try! Data(contentsOf: URL(fileURLWithPath: "\(assets)/\(slug).talking.json"))
    let rig = try! JSONDecoder().decode(RigFile.self, from: data)
    let abilities = AnimalBehaviourDirector.Abilities(
        jaw: rig.max_open_degrees > 0, eyes: !(rig.eyes ?? []).isEmpty, nose: rig.nose != nil, tail: rig.behaviour?.tail != nil)
    for (label, speaking) in [("quiet", [(Double, Double)]()), ("talks", [(20.0, 26.0), (40.0, 43.5)])] {
        var director = AnimalBehaviourDirector(behaviour: rig.behaviour, abilities: abilities, seed: AnimalBehaviourRandom.seed(for: slug))
        var events: [[String: Any]] = []
        var samples: [[Double]] = []
        var last: AnimalIdleBehaviour?
        // 60 frames a second for three minutes, as a renderer would call it.
        for frame in 0..<(180 * 60) {
            let t = Double(frame) / 60
            let isSpeaking = speaking.contains { t >= $0.0 && t < $0.1 }
            let pose = director.pose(at: t, speaking: isSpeaking)
            let now = director.playing
            if now != last {
                events.append(["frame": frame, "kind": now?.rawValue ?? NSNull()])
            }
            last = now
            if frame % 97 == 0 {
                samples.append([Double(frame)] + flat(pose))
            }
        }
        animals.append(["slug": slug, "scenario": label, "seed": String(AnimalBehaviourRandom.seed(for: slug)),
                        "abilities": ["jaw": abilities.jaw, "eyes": abilities.eyes, "nose": abilities.nose, "tail": abilities.tail],
                        "events": events, "samples": samples])
    }
}
out["animals"] = animals
var poses: [[Any]] = []
for kind in AnimalIdleBehaviour.allCases {
    for step in 0..<14 {
        let t = Double(step) * kind.duration / 12 - 0.05
        for direction: Float in [-1, 1] {
            poses.append([kind.rawValue, t, Double(direction)] + flat(AnimalBehaviourDirector.pose(of: kind, at: t, direction: direction)))
        }
    }
}
out["poses"] = poses
out["fields"] = ["mouth", "lid", "pitch", "yaw", "roll", "lift", "nose", "tail", "sway", "stretch"]
let json = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
FileHandle.standardOutput.write(json)
