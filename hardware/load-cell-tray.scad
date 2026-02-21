// ============================================================
// Filla IQ — Scale Tray (Full-Bay, Underside Mount)
// 3D-printed tray hangs UNDER the bay floor
// Floating platforms poke UP through the floor opening
// Front rail sticks UP in front of the bay for TFT displays
//
// STRUCTURE:
//   Tray body: full bay width+depth, hangs below floor
//     Contains both load cells + fixed-end mounts
//   Floating platforms (2x, separate pieces):
//     Bolt to LC free ends, extend up through floor opening
//     Lips front & back, sit above floor surface
//   Front rail: full-width, rises above bay front edge
//     2x TFT display cutouts
//
// LAYOUT (front Y=0 to back Y=bay_d):
//   Front floor zone (70mm) — solid tray floor under bay floor
//   Opening zone (69mm) — cutout in bay floor, platforms poke through
//   Back floor zone (70mm) — solid tray floor, fixed-end LC mounts
//
// COORDINATE SYSTEM:
//   X = left-right (0 = left side of bay)
//   Y = front-back (0 = front of bay)
//   Z = up-down (0 = bay floor TOP surface)
//     Negative Z = below floor (tray body)
//     Positive Z = above floor (platforms, front rail)
//
// Print orientation: right side up (base on bed, walls up — no overhangs)
// ============================================================

// === BAY GEOMETRY (from bay-assembly.scad) ===
bay_w         = 166;
bay_d         = 218;
opening_w     = 150;            // floor opening width (both platforms fit through)
floor_thick   = 16;          // bay floor thickness

// Bay wall thickness (vertical dividers between bays)
bay_wall_w    = 8;

// Spool X positions (centered in usable interior past walls)
pos_left_x    = bay_wall_w + (bay_w - 2*bay_wall_w) * 0.25;    // 45.5
pos_right_x   = bay_wall_w + (bay_w - 2*bay_wall_w) * 0.75;    // 120.5

// === LOAD CELL (80mm bar type, 1kg) ===
lc_len        = 80;
lc_w          = 12.7;
lc_h          = 12.7;
lc_hole_spacing = 10;       // M4 bolt hole spacing per end pair
lc_hole_inset   = 12.5;     // distance from LC end to hole pair center
                             // inner-to-inner hole distance = 45mm
                             // (80 - 2*12.5 - 10 = 45 ✓)

// === M4 CAP SCREW (M4x20) ===
m4_clearance  = 4.5;
m4_head_dia   = 7.5;
m4_head_h     = 4.5;
m4_screw_len  = 20;           // M4x20 — longest available

// === TRAY LAYOUT (front to back, matching bay floor zones) ===
front_zone_d  = 70;          // front solid zone
opening_d     = 69;          // floor opening (platforms poke through)
back_zone_d   = 60;          // back solid zone (fixed LC mounts) — trimmed 10mm

// Derived Y positions (opening in bay floor)
opening_y0    = front_zone_d;                // Y=70
opening_y1    = opening_y0 + opening_d;      // Y=139
tray_depth_y  = front_zone_d + opening_d + back_zone_d;  // 209mm total

// === TRAY BODY (hangs below floor at Z=0) ===
tray_w        = 157;            // tray width (fits inside bay walls)
tray_wall     = 2.4;
tray_base     = 2.0;         // bottom plate thickness
tray_depth    = 32;           // how deep the tray hangs below floor
                              // sized so tray_depth + floor_thick >= 48mm (PCB height)

// === FIXED-END PEDESTAL ===
// Pedestal raises LC so its top is near floor level (Z=0)
// pedestal_h + lc_h + tray_base ≈ tray_depth
pedestal_h    = tray_depth - tray_base - lc_h - 1;  // ~6.3mm
fixed_mount_w = lc_w + 10;

// === FLOATING PLATFORM (separate piece, sits in floor opening) ===
plat_w        = (opening_w - 2) / 2;  // platform width per spool (~2mm gap at center)
plat_d        = opening_d - 1; // platform depth — fits in floor opening with 0.5mm clearance each side
plat_thick    = 4;            // platform plate thickness
lip_h         = 2.5;          // spool retention lip height above floor top
lip_thick     = 2.5;

// Platform top is flush with floor top surface (Z = floor_thick)
// Stem height from LC top to platform bottom:
//   platform bottom Z (world) = floor_thick - plat_thick
//   LC top Z (world) = lc_top_z + lc_h  (computed below)
// stem_z is computed in floating_platform module from these constraints

// === FRONT RAIL (sits in front of bay, uses tray+floor height for displays) ===
front_rail_h  = tray_depth + floor_thick;  // 38mm — from tray bottom to floor top
front_rail_thick = 3;
front_rail_extend = 20;       // how far forward of Y=0

// Display cutout (ST7789 1.69")
disp_vis_w    = 32;            // visible area width
disp_vis_h    = 32;            // visible area height
disp_board_w  = 32;            // PCB width
disp_board_h  = 48;            // PCB height
disp_vis_offset = 7.8;         // visible area bottom edge from PCB bottom
disp_thick    = 6.5;           // PCB + components thickness

// === LOAD CELL Y POSITIONS ===
// Fixed end toward back, free end toward front
// Fixed-end bolt holes under the back zone (below floor)
lc_y_back_end = opening_y1 + lc_hole_inset + lc_hole_spacing/2 + 3;
lc_y_front_end = lc_y_back_end - lc_len;

fixed_hole_y  = lc_y_back_end - lc_hole_inset;  // under back zone
free_hole_y   = lc_y_front_end + lc_hole_inset;  // in opening zone

// LC top Z (below floor surface)
lc_top_z      = -(tray_depth - tray_base - pedestal_h);  // ≈ -lc_h ≈ -12.7

$fn = 32;

// ============================================================
// MODULES
// ============================================================

module m4_cbore_top(depth) {
    // Counterbore sized for M4x20: deepen if screw can't reach through
    cbore_d = max(m4_head_h, depth - m4_screw_len + 2);
    translate([0, 0, depth - cbore_d])
    cylinder(d=m4_head_dia, h=cbore_d + 0.1);
    translate([0, 0, -0.1])
    cylinder(d=m4_clearance, h=depth + 0.2);
}

module m4_cbore_bottom(depth) {
    // Counterbore sized for M4x20: deepen if screw can't reach through
    cbore_d = max(m4_head_h, depth - m4_screw_len + 2);
    translate([0, 0, -0.1])
    cylinder(d=m4_head_dia, h=cbore_d + 0.1);
    translate([0, 0, -0.1])
    cylinder(d=m4_clearance, h=depth + 0.2);
}

// ============================================================
// TRAY BODY (hangs below floor, Z=0 to Z=-tray_depth)
// ============================================================

module tray_body() {
    // Hollow tray — base on bottom, walls going straight up
    // Printed right-side up (base on bed) — no overhangs
    // LC channels, pedestals, and bolt holes subtracted in assembly

    tray_x0 = (bay_w - tray_w) / 2;     // centered in bay
    outer_d = tray_depth_y + 10;
    inner_w = tray_w - 2 * tray_wall;
    inner_d = outer_d - 2 * tray_wall;

    translate([tray_x0, -5, -tray_depth])
    difference() {
        // Outer shell
        cube([tray_w, outer_d, tray_depth]);
        // Hollow interior (leave base plate + walls)
        translate([tray_wall, tray_wall, tray_base])
        cube([inner_w, inner_d, tray_depth]);
    }

    // Center rib (full length, full height, between the two spool positions)
    rib_x = bay_w / 2 - tray_wall / 2;
    translate([rib_x, -5, -tray_depth])
    cube([tray_wall, outer_d, tray_depth]);

    // Longitudinal ribs (front-to-back, stiffen against front-to-back flex)
    // Flanking each LC position to create I-beam stiffening
    lc_rib_offset = lc_w/2 + 5;   // 5mm outside LC channel edge
    for (cx = [pos_left_x - lc_rib_offset, pos_left_x + lc_rib_offset,
               pos_right_x - lc_rib_offset, pos_right_x + lc_rib_offset]) {
        translate([cx - tray_wall/2, -5, -tray_depth])
        cube([tray_wall, outer_d, tray_depth]);
    }

    // Pedestals for fixed-end LC mounts (raised pads inside tray)
    for (cx = [pos_left_x, pos_right_x]) {
        translate([cx - fixed_mount_w/2, fixed_hole_y - lc_hole_spacing/2 - 6, -tray_depth + tray_base])
        cube([fixed_mount_w, lc_hole_spacing + 12, pedestal_h]);
    }
}

// ============================================================
// FIXED-END BOLT HOLES (counterbored from bottom of tray)
// ============================================================

module fixed_end_holes() {
    for (cx = [pos_left_x, pos_right_x]) {
        for (dy = [-lc_hole_spacing/2, lc_hole_spacing/2]) {
            translate([cx, fixed_hole_y + dy, -tray_depth])
            m4_cbore_bottom(tray_base + pedestal_h);
        }
    }
}

// ============================================================
// LOAD CELL CHANNELS (clearance cuts in tray for LC bars)
// ============================================================

module lc_channels() {
    chan_w = lc_w + 3;
    for (cx = [pos_left_x, pos_right_x]) {
        // Channel through the tray for the LC bar
        translate([cx - chan_w/2, lc_y_front_end - 5, -tray_depth + tray_base + pedestal_h])
        cube([chan_w, lc_len + 10, lc_h + 2]);
    }
}

// ============================================================
// FRONT RAIL (sticks up above bay floor, holds TFTs)
// ============================================================

module front_rail() {
    // Rail face sits in front of bay, spans tray bottom to floor top
    // Z = -tray_depth (bottom) to Z = floor_thick (floor top)
    // Displays fit within this height (38mm)

    tray_x0 = (bay_w - tray_w) / 2;
    translate([tray_x0, -front_rail_extend, -tray_depth])
    difference() {
        union() {
            // Vertical face (tray width x full height)
            cube([tray_w, front_rail_thick, front_rail_h]);

            // Base connecting to tray body
            cube([tray_w, front_rail_extend + 5, tray_depth]);
        }

        // Display cutouts
        pcb_slot_w = 5;   // PCB pocket depth behind face
        cap_thick  = 2;   // solid cap above slot in base area

        for (cx = [pos_left_x - tray_x0, pos_right_x - tray_x0]) {
            // PCB centered vertically in rail
            pcb_z0 = (front_rail_h - disp_board_h) / 2;
            // Visible area is offset 7.8mm from PCB bottom
            vis_z0 = pcb_z0 + disp_vis_offset;

            // Visible window through the face (32x32)
            translate([cx - disp_vis_w/2, -0.1, vis_z0])
            cube([disp_vis_w, front_rail_thick + 0.2, disp_vis_h]);

            // Above the base (Z > tray_depth): full PCB pocket behind face
            // No base here, just the thin vertical face — open behind
            translate([cx - disp_board_w/2, front_rail_thick - 0.1, tray_depth])
            cube([disp_board_w, disp_thick + 0.5, front_rail_h - tray_depth]);

            // In the base zone (Z < tray_depth): thin slot for PCB board only
            // Connects to pocket above — no cap/rib blocking LCD insertion
            translate([cx - disp_board_w/2, front_rail_thick - 0.1, pcb_z0])
            cube([disp_board_w, pcb_slot_w, tray_depth - pcb_z0]);
        }
    }
}


// ============================================================
// FLOATING PLATFORM (separate piece, print 2x)
// Pokes up through floor opening, bolts to LC free end
// ============================================================

module floating_platform(bolt_offset_x = -1, bolt_offset_y = -1, stem_h = 13) {
    // Origin at bottom-front-left corner of platform footprint
    // bolt_offset_x: X distance from platform left edge to bolt center
    // bolt_offset_y: Y distance from platform front edge to bolt center
    // stem_h: height from LC top to platform bottom (computed in assembly)
    //
    // Platform sits IN the floor opening, top flush with floor surface.
    // Only the small lips protrude above the floor to keep spool off the bay.

    bx = (bolt_offset_x < 0) ? plat_w/2 : bolt_offset_x;
    by = (bolt_offset_y < 0) ? plat_d/2 : bolt_offset_y;
    riser_w = lc_w + 6;
    riser_d_actual = lc_hole_spacing + 12;

    total_bolt_depth = stem_h + plat_thick;

    difference() {
        union() {
            // Narrow stem (passes through floor opening)
            translate([bx - riser_w/2, by - riser_d_actual/2, 0])
            cube([riser_w, riser_d_actual, stem_h]);

            // Platform plate (sits in floor opening, top flush with floor top)
            translate([0, 0, stem_h])
            cube([plat_w, plat_d, plat_thick]);

            // Front lip (protrudes above floor surface)
            translate([0, 0, stem_h + plat_thick])
            cube([plat_w, lip_thick, lip_h]);

            // Back lip (protrudes above floor surface)
            translate([0, plat_d - lip_thick, stem_h + plat_thick])
            cube([plat_w, lip_thick, lip_h]);
        }

        // M4 counterbored holes from top (centered on LC position)
        for (dy = [-lc_hole_spacing/2, lc_hole_spacing/2]) {
            translate([bx, by + dy, 0])
            m4_cbore_top(total_bolt_depth);
        }
    }
}

// ============================================================
// GHOST HARDWARE
// ============================================================

module ghost_load_cells() {
    lc_z = -tray_depth + tray_base + pedestal_h;
    color("Silver", 0.5)
    for (cx = [pos_left_x, pos_right_x]) {
        translate([cx - lc_w/2, lc_y_front_end, lc_z])
        cube([lc_w, lc_len, lc_h]);
    }
}

module ghost_displays() {
    // Displays centered vertically in front rail (tray bottom to floor top)
    disp_cz = -tray_depth + front_rail_h / 2;
    color("DodgerBlue", 0.6)
    for (cx = [pos_left_x, pos_right_x]) {
        translate([cx - disp_board_w/2, -front_rail_extend + front_rail_thick + 1,
                   disp_cz - disp_board_h/2])
        cube([disp_board_w, 4, disp_board_h]);
    }
}

module ghost_floor() {
    color("BurlyWood", 0.2)
    translate([0, 0, 0])
    difference() {
        cube([bay_w, bay_d, floor_thick]);
        // Floor opening (where platforms poke through)
        translate([(bay_w - opening_w)/2, opening_y0, -0.1])
        cube([opening_w, opening_d, floor_thick + 0.2]);
    }
}

module ghost_spools() {
    spool_dia = 200;
    spool_w   = 73;
    plat_surface_z = plat_above + floor_thick + plat_thick;
    color("White", 0.08)
    for (cx = [pos_left_x, pos_right_x]) {
        translate([cx, bay_d/2, plat_surface_z + spool_dia/2])
        rotate([0, 90, 0])
        cylinder(d=spool_dia, h=spool_w, center=true, $fn=48);
    }
}

module ghost_bay_walls() {
    color("BurlyWood", 0.1) {
        translate([-3, 0, -tray_depth])
        cube([3, bay_d, tray_depth + 250]);
        translate([bay_w, 0, -tray_depth])
        cube([3, bay_d, tray_depth + 250]);
        translate([0, bay_d, -tray_depth])
        cube([bay_w, 3, tray_depth + 250]);
    }
}


// ============================================================
// ASSEMBLY
// ============================================================

// Tray body (below floor)
color("SteelBlue", 0.85)
difference() {
    tray_body();
    fixed_end_holes();
    lc_channels();
}

// Front rail (below + above floor)
color("SaddleBrown", 0.85)
front_rail();

// Floating platforms (sit in floor opening, top flush with floor surface)
// Only lips protrude above floor to keep spool from resting on bay
color("SeaGreen", 0.85) {
    lc_z_top = -tray_depth + tray_base + pedestal_h + lc_h;  // Z of LC top surface
    // stem goes from LC top up to platform bottom (flush: plat top = floor_thick)
    plat_stem_h = (floor_thick - plat_thick) - lc_z_top;

    opening_x0 = (bay_w - opening_w) / 2;
    plat_y = opening_y0 + 0.5;                          // centered in opening with 0.5mm clearance
    plat_left_x  = opening_x0;                          // left platform outer edge
    plat_right_x = bay_w/2 + 1;                         // right platform inner edge (~2mm gap)

    // Bolt Y offset: distance from platform front edge to bolt center
    bolt_oy = free_hole_y - plat_y;

    // Left platform
    translate([plat_left_x, plat_y, lc_z_top])
    floating_platform(bolt_offset_x = pos_left_x - plat_left_x, bolt_offset_y = bolt_oy, stem_h = plat_stem_h);

    // Right platform
    translate([plat_right_x, plat_y, lc_z_top])
    floating_platform(bolt_offset_x = pos_right_x - plat_right_x, bolt_offset_y = bolt_oy, stem_h = plat_stem_h);
}

// Ghost context
ghost_load_cells();
ghost_displays();
ghost_floor();
ghost_spools();
ghost_bay_walls();


// ============================================================
// BUILD INFO
// ============================================================

echo("=== FILLA IQ — SCALE TRAY (UNDERSIDE MOUNT) ===");
echo(str("Tray hangs from Z=0 to Z=", -tray_depth, " (below bay floor)"));
echo(str("Tray footprint: ", tray_w, " x ", tray_depth_y + 10, " mm"));
echo(str("Front rail: ", front_rail_h, "mm above floor, ", front_rail_extend, "mm forward"));
echo("");
echo(str("Front zone: Y=0 to Y=", opening_y0, " (", front_zone_d, "mm solid floor)"));
echo(str("Opening: Y=", opening_y0, " to Y=", opening_y1, " (", opening_d, "mm — platforms poke through)"));
echo(str("Back zone: Y=", opening_y1, " to Y=", tray_depth_y, " (", back_zone_d, "mm — fixed LC mounts)"));
echo("");
echo(str("Load cells: X=", pos_left_x, " and X=", pos_right_x));
echo(str("  Fixed holes at Y=", fixed_hole_y, " (counterbored from bottom)"));
echo(str("  Free holes at Y=", free_hole_y, " (platform bolts from top)"));
echo("");
echo(str("Platform top flush with floor top (Z=", floor_thick, "mm)"));
echo(str("Lips protrude ", lip_h, "mm above floor surface"));
echo(str("Platform: ", plat_w, " x ", plat_d, "mm, ", plat_thick, "mm thick"));
echo("");
echo("HARDWARE:");
echo("  4x M4 cap screw (bottom, fixed ends)");
echo("  4x M4 cap screw (top, platform free ends)");
echo("  2x bar load cell (80mm, 1kg)");
echo("");
echo("PRINT (right side up — base on bed, walls up, no overhangs):");
echo("  1x tray body + front rail");
echo("  2x floating platform");
