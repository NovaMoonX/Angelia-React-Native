#!/bin/bash
set -e

echo ""
echo "🚀 Starting iOS setup..."
echo ""

# ── 1. Prebuild ──────────────────────────────────────────────────────────────
echo "📦 Running expo prebuild (clean)..."
npx expo prebuild --platform ios --clean
echo "✅ Prebuild complete"
echo ""

# ── 2. Patch Podfile ─────────────────────────────────────────────────────────
echo "🔧 Patching Podfile for react-native-firebase..."

python3 - <<'EOF'
with open("ios/Podfile", "r") as f:
    content = f.read()

patch = """
  # Fix non-modular header errors for react-native-firebase
  installer.pods_project.targets.each do |target|
    if target.name.start_with?("RNFB")
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'NO'
        config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end
"""

if "Fix non-modular header" in content:
    print("✅ Patch already applied, skipping")
else:
    # Insert before the final end/end closing the post_install block
    content = content.replace(
        "  end\nend",
        patch + "\n  end\nend",
        1  # only replace first occurrence
    )
    with open("ios/Podfile", "w") as f:
        f.write(content)
    print("✅ Podfile patched successfully")
EOF

echo ""

# ── 3. Pod Install ───────────────────────────────────────────────────────────
echo "📦 Running pod install..."
cd ios
pod install
cd ..
echo "✅ Pod install complete"
echo ""

# ── 4. Done ──────────────────────────────────────────────────────────────────
echo "✅ iOS setup complete!"
echo ""
echo "Next steps:"
echo "  Simulator → npx expo run:ios --simulator"
echo "  Device    → npx expo run:ios --device"
echo ""