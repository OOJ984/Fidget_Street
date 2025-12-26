// Flower Clicker - Parts laid out separately
// 1 petal keycap only (duplicate yourself)

$fn = 60;

// =====================================================
// PARAMETERS
// =====================================================

// Flower shape
petal_count = 5;
center_radius = 14;
petal_length = 24;
petal_width = 20;
petal_distance = 18;

// Bottom housing
base_height = 12;
rim_width = 2.5;
rim_height = 14;

// MX switch hole
mx_cutout = 14.0;

// Keycap dimensions
cap_height = 6;
stem_width = 4.0;
stem_thickness = 1.2;
stem_depth = 4.0;

keycap_center_radius = 11;

// Petal keycap - matching the image
petal_cap_width = 18;
petal_cap_length = 20;
petal_cap_height = 8;       // Taller for more rounded look
lobe_radius = 8;            // Larger lobes for flowy look

// Bottom floor
floor_thickness = 1.5;      // Floor at bottom of housing

// =====================================================
// MODULES
// =====================================================

module heart_petal(length, width, height) {
    // Rounded heart petal with bulbous lobes
    lobe_r = width/2.2;  // Big round lobes

    hull() {
        // Left lobe - big round bulb
        translate([width/2.8, length - lobe_r, height/2])
            scale([1, 1.1, 1])
                cylinder(h = height, r = lobe_r, center = true);
        // Right lobe - big round bulb
        translate([-width/2.8, length - lobe_r, height/2])
            scale([1, 1.1, 1])
                cylinder(h = height, r = lobe_r, center = true);
        // Bottom point - small for heart shape
        translate([0, 0, height/2])
            cylinder(h = height, r = width/6, center = true);
    }
}

module heart_petal_rim(length, width, height, rim) {
    difference() {
        heart_petal(length + rim, width + rim*2, height);
        translate([0, 0, -0.1])
            heart_petal(length - rim/2, width - rim, height + 1);
    }
}

module mx_hole() {
    // Main 14mm hole - but narrower at clip area so switches snap in
    // Top section - full 14mm for switch body
    translate([-mx_cutout/2, -mx_cutout/2, floor_thickness])
        cube([mx_cutout, mx_cutout, base_height + 1]);
}

// Retention clips - add these AFTER the difference
module mx_retention_clips() {
    // Small lips that stick into the hole for switch to grab
    lip_width = 4;
    lip_depth = 0.8;  // How far into hole
    lip_height = 1.2;
    lip_z = base_height - 3;  // Position from bottom

    // Front lip
    translate([-lip_width/2, -mx_cutout/2, lip_z])
        cube([lip_width, lip_depth, lip_height]);

    // Back lip
    translate([-lip_width/2, mx_cutout/2 - lip_depth, lip_z])
        cube([lip_width, lip_depth, lip_height]);
}

module mx_cross_socket() {
    cube([stem_width, stem_thickness, stem_depth], center = true);
    cube([stem_thickness, stem_width, stem_depth], center = true);
}

// =====================================================
// BOTTOM HOUSING
// =====================================================
module flower_bottom() {
    union() {
        difference() {
            union() {
                cylinder(h = base_height, r = center_radius + 6);

                for (i = [0 : petal_count - 1]) {
                    angle = 360 * i / petal_count + 90;
                    rotate([0, 0, angle])
                    translate([0, center_radius - 4, 0])
                        heart_petal(petal_length, petal_width, base_height);
                }

                for (i = [0 : petal_count - 1]) {
                    angle1 = 360 * i / petal_count + 90;
                    angle2 = 360 * (i + 1) / petal_count + 90;
                    hull() {
                        rotate([0, 0, angle1])
                        translate([petal_width/2.5, center_radius + 2, 0])
                            cylinder(h = base_height, r = 3);
                        rotate([0, 0, angle2])
                        translate([-petal_width/2.5, center_radius + 2, 0])
                            cylinder(h = base_height, r = 3);
                        rotate([0, 0, (angle1 + angle2) / 2])
                        translate([0, center_radius - 2, 0])
                            cylinder(h = base_height, r = 4);
                    }
                }

                for (i = [0 : petal_count - 1]) {
                    angle = 360 * i / petal_count + 90;
                    rotate([0, 0, angle])
                    translate([0, center_radius - 4, 0])
                        heart_petal_rim(petal_length, petal_width, rim_height, rim_width);
                }

                difference() {
                    cylinder(h = rim_height, r = center_radius + 1);
                    translate([0, 0, -0.1])
                        cylinder(h = rim_height + 1, r = center_radius - 2);
                }
            }

            mx_hole();

            for (i = [0 : petal_count - 1]) {
                angle = 360 * i / petal_count + 90;
                rotate([0, 0, angle])
                translate([0, petal_distance, 0])
                    mx_hole();
            }
        }

        // Add retention clips to all switch holes
        mx_retention_clips();

        for (i = [0 : petal_count - 1]) {
            angle = 360 * i / petal_count + 90;
            rotate([0, 0, angle])
            translate([0, petal_distance, 0])
                mx_retention_clips();
        }
    }
}

// =====================================================
// CENTER KEYCAP (domed circle - dome goes to edge)
// =====================================================
module center_keycap() {
    difference() {
        union() {
            cylinder(h = cap_height, r = keycap_center_radius);
            // Dome goes all the way to edge
            translate([0, 0, cap_height])
                scale([1, 1, 0.35])
                    sphere(r = keycap_center_radius);
        }
        // Flatten bottom
        translate([0, 0, -10])
            cube([50, 50, 20], center = true);
        // MX cross socket underneath
        translate([0, 0, stem_depth/2])
            mx_cross_socket();
    }
}

// =====================================================
// PETAL KEYCAP - PRECISE FIT CALCULATIONS
// =====================================================

// Rim cavity dimensions (where keycap sits):
// - Cavity length = petal_length - rim_width/2 = 24 - 1.25 = 22.75mm
// - Cavity width = petal_width - rim_width = 20 - 2.5 = 17.5mm

// 3D print tolerance: 0.3mm gap per side for snug fit
print_tolerance = 0.3;

// Final keycap dimensions
keycap_petal_length = (petal_length - rim_width/2) - print_tolerance;  // 22.75 - 0.3 = 22.45mm
keycap_petal_width = (petal_width - rim_width) - print_tolerance * 2;   // 17.5 - 0.6 = 16.9mm

module petal_keycap() {
    cap_h = 10;  // Thick keycap
    round_r = 2; // Rounding radius for smooth edges
    lobe_r = keycap_petal_width/2.2;  // Match bottom housing

    difference() {
        // Rounded heart petal shape - matches bottom housing
        minkowski() {
            hull() {
                // Left lobe - big round bulb
                translate([keycap_petal_width/2.8, keycap_petal_length - lobe_r, 0])
                    scale([1, 1.1, 1])
                        cylinder(h = cap_h - round_r*2, r = lobe_r - round_r);
                // Right lobe - big round bulb
                translate([-keycap_petal_width/2.8, keycap_petal_length - lobe_r, 0])
                    scale([1, 1.1, 1])
                        cylinder(h = cap_h - round_r*2, r = lobe_r - round_r);
                // Bottom point - small
                cylinder(h = cap_h - round_r*2, r = keycap_petal_width/6 - round_r);
            }
            sphere(r = round_r);
        }

        // Heart dip - smaller, all edges rounded smooth
        hull() {
            // Inner point - large sphere for smooth rounded edge
            translate([0, keycap_petal_length - 2, cap_h + 3])
                sphere(r = 4);
            // Top - large sphere for smooth rounded edge
            translate([0, keycap_petal_length + 3, cap_h + 5])
                scale([0.5, 1, 1])
                    sphere(r = 6);
        }

        // VERTICAL CENTER CREASE - 27mm long
        hull() {
            // Wide rounded end (middle of petal)
            translate([0, -11, cap_h + 4])
                scale([0.6, 1, 1])
                    sphere(r = 8);
            // Thin end
            translate([0, 16, cap_h + 4])
                scale([0.3, 1, 1])
                    sphere(r = 5);
        }

        // Flatten bottom
        translate([0, 0, -10])
            cube([60, 60, 20], center = true);

        // MX cross socket underneath - centered on switch position
        translate([0, petal_distance - (center_radius - 4), stem_depth/2])
            mx_cross_socket();
    }
}

// =====================================================
// LAYOUT - ALL PARTS SEPARATED
// =====================================================

// Bottom housing (center)
color("hotpink")
    flower_bottom();

// Center keycap (to the right)
color("gold")
translate([70, 0, 0])
    center_keycap();

// ONE petal keycap (further right) - duplicate this yourself
color("lightpink")
translate([110, 0, 0])
    petal_keycap();
