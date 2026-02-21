// ============================================================
// Filla IQ — NFC Wall Mount (Dual PN532 Sandwich)
//
// Two PN532 boards mounted back-to-back, screwed to a plastic
// center piece. The whole assembly straddles a diagonal brace
// member above the X on the left side wall.
//
// The bottom V of the diamond sits over the brace — each lower
// edge grips one side, like a saddle. The brace runs through
// the V-channel at the bottom, NOT through the center of the
// sandwich.
//
// BRACE GEOMETRY (from 3MF analysis):
//   Each diagonal member: 12.2mm wide, ~8mm thick
//   Diagonal angle: ~47° from horizontal
//
// Print flat (one PN532 face down on bed)
// ============================================================

// === PN532 BOARD (red ~43mm square) ===
pn532_w       = 43.5;       // board width + tolerance
pn532_h       = 43.5;       // board height + tolerance
pn532_pcb_t   = 1.6;        // PCB thickness
pn532_comp_t  = 3.0;        // component height on back face
pn532_hole_d  = 3.2;        // mounting hole diameter
pn532_hole_inset = 7.95;    // hole center from board edge (measured)

// === BRACE MEMBER (from 3MF mesh) ===
brace_w       = 12.2;       // member width (in wall plane)
brace_t       = 8.0;        // member thickness (depth from wall)
brace_fillet  = 3.0;        // fillet radius on brace corners
diag_angle    = 47;

// === BODY SHELL ===
// PCBs sit in pockets on each face, screwed in (no slide-in slots).
// Components face outward into the pocket cavity.
face_t        = 1.2;        // thin face shell over antenna area for NFC range
center_t      = 2.0;        // solid center between the two comp cavities

// Total body thickness
body_thick    = 2 * (face_t + pn532_pcb_t + pn532_comp_t) + center_t;
// = 2*(1.2 + 1.6 + 3.0) + 2.0 = 13.6mm

// === BOARD OFFSET (scoot up to clear brace slot) ===
board_offset_y = 7;            // shift boards up from diamond center

// === DIAMOND OUTLINE (auto-sized for offset boards + frame) ===
frame_min     = 4;             // min solid frame around board pocket
board_reach   = board_offset_y + (max(pn532_w, pn532_h) + 0.6) * sqrt(2) / 2;
diamond_diag  = 2 * (board_reach + frame_min);   // ~84.4mm tip-to-tip
diamond_side  = diamond_diag / sqrt(2);           // ~59.7mm side

// === BRACE SLOT (rectangular channel at bottom for brace passage) ===
chan_clearance = 0.4;
chan_w         = brace_t + chan_clearance;     // 8.4mm channel width in Z (body thickness)
chan_depth     = brace_w + 12;                // how far up from bottom tip (~24mm)
brace_slot_w  = brace_w + 1;                 // slot width perpendicular to brace

// Channel is centered in body thickness
chan_z0        = (body_thick - chan_w) / 2;
chan_z1        = chan_z0 + chan_w;

// Slot center Y position (centered in the channel zone above bottom tip)
brace_slot_y  = -diamond_diag/2 + chan_depth/2;

// === SCREW HOLES ===
screw_d       = 3.4;         // M3 clearance
screw_head_d  = 6.0;         // M3 cap head
screw_head_h  = 3.0;

show_ghosts = false;  // set true to visualize boards + brace in OpenSCAD

$fn = 32;

// Z-STACK (local Z, 0 = side B exterior face)
z_pcb_b       = face_t;                           // 1.2
z_comp_b      = z_pcb_b + pn532_pcb_t;            // 2.8
z_center      = z_comp_b + pn532_comp_t;           // 5.8
z_comp_a      = z_center + center_t;               // 7.8
z_pcb_a       = z_comp_a + pn532_comp_t;           // 10.8
z_face_a      = z_pcb_a + pn532_pcb_t;             // 12.4


// ============================================================
// MODULES
// ============================================================

module diamond_2d() {
    rotate([0, 0, 45])
    offset(r = 2) offset(r = -2)
    square([diamond_side, diamond_side], center = true);
}

module pn532_2d() {
    translate([0, board_offset_y])
    rotate([0, 0, 45])
    offset(delta = 0.3)
    square([pn532_w, pn532_h], center = true);
}

module screw_positions() {
    // 2 holes per board at opposite diagonal corners
    // Use the left-right pair (not top-bottom) to avoid V-channel zone
    h_off = pn532_w/2 - pn532_hole_inset;  // ~13.8mm from center
    translate([0, board_offset_y, 0])
    rotate([0, 0, 45])
    for (s = [-1, 1])
        translate([s * h_off, -s * h_off, 0])
        children();
}


module nfc_mount() {
    difference() {
        // Solid diamond body
        linear_extrude(body_thick)
        diamond_2d();

        // === V-CHANNELS (grooves along both lower edges) ===
        // Each lower edge gets a groove: open on the outer face,
        // runs the full edge length, with a wall on the inside.
        // The brace sits in these grooves.
        chan_groove_d  = brace_t/2 + brace_fillet + 0.5;  // groove depth into arm (~7.5mm)
        for (mx = [0, 1]) {
            mirror([mx, 0, 0])
            translate([0, -diamond_diag/2, 0])
            rotate([0, 0, 45]) {
                // Main groove at brace Z-range
                translate([-1, -50, chan_z0])
                cube([diamond_side + 2, 50 + chan_groove_d, chan_w]);
            }
        }

        // Clip inner wall of grooves near bottom tip for X brace junction fillet
        // The fillet where the two brace members join adds material at the
        // inside corner — deepen the grooves near the tip to clear it.
        for (mx = [0, 1]) {
            mirror([mx, 0, 0])
            translate([0, -diamond_diag/2, 0])
            rotate([0, 0, 45]) {
                translate([-1, -50, chan_z0])
                cube([brace_fillet * 6, 50 + chan_groove_d + brace_fillet * 3, chan_w]);
            }
        }

        // === PN532 POCKETS (no slide-in slots, boards screw in) ===

        // Side B (bottom face): PCB recess + component cavity
        translate([0, 0, -0.1])
        linear_extrude(face_t + pn532_pcb_t + 0.1)
        pn532_2d();

        translate([0, 0, z_comp_b])
        linear_extrude(pn532_comp_t + 0.1)
        pn532_2d();

        // Side A (top face): PCB recess + component cavity
        translate([0, 0, z_pcb_a])
        linear_extrude(pn532_pcb_t + face_t + 0.2)
        pn532_2d();

        translate([0, 0, z_comp_a - 0.1])
        linear_extrude(pn532_comp_t + 0.1)
        pn532_2d();

        // === SCREW HOLES (M3, through entire body) ===
        screw_positions() {
            translate([0, 0, -0.1])
            cylinder(d = screw_d, h = body_thick + 0.2);
        }

    }
}


// ============================================================
// RENDER
// ============================================================

color("SteelBlue", 0.85)
nfc_mount();

if (show_ghosts) {
    // Ghost PN532 boards (sitting in pockets, offset up)
    color("Red", 0.5) {
        // Side A (top)
        translate([0, board_offset_y, z_pcb_a])
        linear_extrude(pn532_pcb_t)
        rotate([0, 0, 45])
        square([pn532_w, pn532_h], center = true);

        // Side B (bottom)
        translate([0, board_offset_y, face_t])
        linear_extrude(pn532_pcb_t)
        rotate([0, 0, 45])
        square([pn532_w, pn532_h], center = true);
    }

    // Ghost brace member (sits in the brace slot)
    color("BurlyWood", 0.3) {
        brace_len = 100;
        translate([0, brace_slot_y, chan_z0])
        rotate([0, 0, diag_angle])
        translate([-brace_len/2, -brace_w/2, 0])
        cube([brace_len, brace_w, brace_t]);
    }
}


// ============================================================
// BUILD INFO
// ============================================================

echo("=== NFC WALL MOUNT — DUAL PN532 SANDWICH ===");
echo(str("Total thickness: ", body_thick, "mm"));
echo(str("Diamond: ", diamond_side, "mm side (", diamond_diag, "mm tip-to-tip)"));
echo(str("Brace slot: ", brace_slot_w, "mm wide, at Y=", brace_slot_y, ", Z=", chan_z0, " to ", chan_z1));
echo(str("  Slot depth from bottom tip: ", chan_depth, "mm"));
echo("");
echo(str("Board offset from center: +", board_offset_y, "mm (up, away from brace)"));
echo("PCB pockets on both faces (screwed in, no slide slots):");
echo(str("  Side B: PCB at Z=", face_t, ", comps Z=", z_comp_b, " to ", z_center));
echo(str("  Side A: PCB at Z=", z_pcb_a, ", comps Z=", z_comp_a, " to ", z_pcb_a));
echo("");
echo("HARDWARE: 2x M3 screw + nut (opposite diagonal corners, through both boards)");
echo("PRINT: flat on one face.");
echo("MOUNT: slide bottom V over brace member, screw boards on.");
