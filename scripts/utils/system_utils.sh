#!/bin/bash

# Standard Error Handling
set -e
set -u
set -o pipefail

# System Operation Utilities
# Version: 1.0.0
# Author: Benjamin Pequet
# Projects: https://github.com/pequet/ 
# Purpose: Provides system and disk utility functions.
# Refer to main project for detailed docs.

# --- Guard against direct execution ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "This script provides utility functions and is not meant to be executed directly." >&2
    echo "Please source it from another DLS script." >&2
    exit 1
fi

# --- Function Definitions ---

# *
# * RAM Disk Management
# *

# Prompts the user for the path to a RAM disk. If the user doesn't provide one,
# it offers to create one for them.
# Returns the path to the RAM disk via stdout.
# Requires input_utils.sh to be sourced for get_input function
function prompt_for_ram_disk() {
    echo "All sensitive files will be written to a volatile working directory (RAM disk)." >&2
    local ram_disk_path
    ram_disk_path=$(get_input "Enter the full path to your RAM disk (or press Enter to have one created)")

    if [[ -z "$ram_disk_path" ]]; then
        echo "No path provided. Creating a temporary 512MB RAM disk at /Volumes/RAMDISK..." >&2
        local ram_disk_name="RAMDISK"
        local ram_disk_mount_point="/Volumes/${ram_disk_name}"
        
        # Eject if it already exists from a failed previous run
        diskutil unmount "$ram_disk_mount_point" &>/dev/null || true
        
        # Create the RAM disk, redirecting its output to /dev/null
        if ! diskutil erasevolume HFS+ "$ram_disk_name" `hdiutil attach -nomount ram://1048576` >/dev/null; then
            echo "ERROR: Failed to create RAM disk. Please try creating one manually." >&2
            return 1
        fi

        # Wait for the volume to mount, checking for up to 5 seconds
        local wait_seconds=5
        while [[ ! -d "$ram_disk_mount_point" && $wait_seconds -gt 0 ]]; do
            sleep 0.01
            echo "Waiting for RAM disk to mount..." >&2
            ((wait_seconds--))
        done

        if [[ ! -d "$ram_disk_mount_point" ]]; then
            echo "ERROR: RAM disk was created but failed to mount in time at ${ram_disk_mount_point}." >&2
            return 1
        fi
        
        echo "RAM disk created successfully at ${ram_disk_mount_point}" >&2
        ram_disk_path="$ram_disk_mount_point"
    fi

    # Final validation
    if [[ -d "$ram_disk_path" ]]; then
        echo "$ram_disk_path"
    else
        echo "ERROR: Directory not found at '${ram_disk_path}'. Please provide a valid path." >&2
        return 1
    fi
} 