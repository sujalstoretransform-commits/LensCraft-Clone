export type EyeRx = {
    sph?: number;
    cyl?: number;
    axis?: number;
    add?: number;
}

export type Prescription = {
    right: EyeRx,
    left: EyeRx,
    pd: { single?: number; right?: number; left?: number }
}

const LIMITS = {
    sph: { min: -15, max: 10 },
    cyl: { min: -6, max: 6 },
    axis: { min: 1, max: 180 },
    singlePd: { min: 50, max: 78 },
}

const inRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
}

const checkEye = (eye: EyeRx, label: string, needsAdd: boolean) => {
    const errors: string[] = []

    if (eye.sph === undefined) {
        errors.push(`${label}: SPH is required.`)
    }
    else if (!inRange(eye.sph, LIMITS.sph.min, LIMITS.sph.max)) {
        errors.push(`${label}: SPH must be between -15.00 and +10.00.`)
    }

    if (eye.cyl !== undefined) {
        if (!inRange(eye.cyl, LIMITS.cyl.min, LIMITS.cyl.max)) {
            errors.push(`${label}: CYL must be between -6.00 and +6.00.`);
        }
        if (eye.cyl !== 0 && eye.axis === undefined) {
            errors.push(`${label}: Axis is required when CYL is entered.`);
        }
    }

    if (eye.axis !== undefined) {
        if (!inRange(eye.axis, LIMITS.axis.min, LIMITS.axis.max)) {
            errors.push(`${label}: Axis must be between 1 and 180.`);
        }
    }

    if (needsAdd && eye.add === undefined) {
        errors.push(`${label}: ADD is required for this lens type.`);
    }

    return errors
}

export const validatePrescription = (rx: Prescription, needsAdd = false) => {
    const errors = [
        ...checkEye(rx.right, "Right eye", needsAdd),
        ...checkEye(rx.left, "Left eye", needsAdd)
    ]

    const { single, right, left } = rx.pd;

    if (single !== undefined) {
        if (!inRange(single, LIMITS.singlePd.min, LIMITS.singlePd.max)) {
            errors.push("PD must be between 50 and 78 mm.");
        }
    } else if (right === undefined || left === undefined) {
        errors.push("Enter a single PD or both right and left PD.");
    }

    return { valid: errors.length === 0, errors }

}