Import("env")

# Add project include/ dir to C/C++ include path only (not assembler)
# so LVGL can find lv_conf.h
inc_dir = env.subst("$PROJECT_INCLUDE_DIR")
env.Append(CCFLAGS=["-I", inc_dir])

