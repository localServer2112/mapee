import CoreTelephony
import Flutter
import UIKit

public class MapeeRadioPlugin: NSObject, FlutterPlugin, RadioInfoHostApi {
  private let networkInfo = CTTelephonyNetworkInfo()

  public static func register(with registrar: FlutterPluginRegistrar) {
    let instance = MapeeRadioPlugin()
    RadioInfoHostApiSetup.setUp(binaryMessenger: registrar.messenger(), api: instance)
  }

  func getRadioInfo(completion: @escaping (Result<RadioInfo, Error>) -> Void) {
    completion(
      .success(
        RadioInfo(
          carrierName: readCarrierName(),
          radioAccessTechnology: readRadioAccessTechnology()
        )
      )
    )
  }

  // Apple has progressively locked this down since iOS 16: on a real modern
  // device this typically returns nil, or a carrier object whose
  // `carrierName` is a generic placeholder rather than the real network
  // name. That is genuine platform behavior, not a bug in this plugin -
  // return exactly what CoreTelephony gives us, no fallback or guessing.
  private func readCarrierName() -> String? {
    guard let providers = networkInfo.serviceSubscriberCellularProviders else {
      return nil
    }
    for (_, carrier) in providers {
      if let name = carrier.carrierName, !name.isEmpty {
        return name
      }
    }
    return nil
  }

  private func readRadioAccessTechnology() -> String? {
    guard let radioTechnologies = networkInfo.serviceCurrentRadioAccessTechnology else {
      return nil
    }
    for (_, technology) in radioTechnologies {
      if let rat = ratStringToGeneration(technology) {
        return rat
      }
    }
    return nil
  }

  // Maps CTRadioAccessTechnology* constants to the same "2G"/"3G"/"4G"/"5G"
  // strings the Android side produces. Values with no clean generation
  // mapping (there are none left unmapped among the documented constants,
  // but the API is a free-form string) fall through to nil.
  private func ratStringToGeneration(_ technology: String) -> String? {
    switch technology {
    case CTRadioAccessTechnologyGPRS,
      CTRadioAccessTechnologyEdge,
      CTRadioAccessTechnologyCDMA1x:
      return "2G"
    case CTRadioAccessTechnologyWCDMA,
      CTRadioAccessTechnologyHSDPA,
      CTRadioAccessTechnologyHSUPA,
      CTRadioAccessTechnologyCDMAEVDORev0,
      CTRadioAccessTechnologyCDMAEVDORevA,
      CTRadioAccessTechnologyCDMAEVDORevB,
      CTRadioAccessTechnologyeHRPD:
      return "3G"
    case CTRadioAccessTechnologyLTE:
      return "4G"
    default:
      if #available(iOS 14.1, *), technology == CTRadioAccessTechnologyNRNSA
        || technology == CTRadioAccessTechnologyNR
      {
        return "5G"
      }
      return nil
    }
  }
}
