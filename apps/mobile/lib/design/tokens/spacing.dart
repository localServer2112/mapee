/// 4pt base spacing scale, screen margins, radii, and minimum hit targets
/// (plan §4.3). The 44×44pt minimum matters concretely: today's web app has
/// a 12px mobile menu icon and a 20px close button, both below it.
class MapeeSpacing {
  const MapeeSpacing._();

  static const double unit = 4;
  static const double xs = unit; // 4
  static const double sm = unit * 2; // 8
  static const double md = unit * 4; // 16
  static const double lg = unit * 6; // 24
  static const double xl = unit * 8; // 32

  static const double screenMargin = md;
  static const double minHitTarget = 44;

  static const double radiusControl = 10;
  static const double radiusCard = 14;
  static const double radiusSheet = 38;
}
