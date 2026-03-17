Import("env")
import os

# Add project include/ dir to C/C++ include path only (not assembler)
# so LVGL can find lv_conf.h
inc_dir = env.subst("$PROJECT_INCLUDE_DIR")
env.Append(CCFLAGS=["-I", inc_dir])

# Framework libraries needed by SD_MMC (FS.h dependency chain)
framework_dir = env.PioPlatform().get_package_dir("framework-arduinoespressif32")
fs_lib_dir = os.path.join(framework_dir, "libraries", "FS", "src")
if os.path.isdir(fs_lib_dir):
    env.Append(CPPPATH=[fs_lib_dir])
