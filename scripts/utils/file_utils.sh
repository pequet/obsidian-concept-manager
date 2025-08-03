#!/bin/bash

# Standard Error Handling
set -e
set -u
set -o pipefail

# File Operation Utilities
# Version: 1.0.0
# Author: Benjamin Pequet
# Projects: https://github.com/pequet/ 
# Purpose: Provides file system utility functions.
# Refer to main project for detailed docs.

# --- Guard against direct execution ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "This script provides utility functions and is not meant to be executed directly." >&2
    echo "Please source it from another DLS script." >&2
    exit 1
fi

# --- Function Definitions ---

# *
# * File Timestamp Operations
# *

# Clones the modification timestamp from a source file to a destination file.
# Arguments:
#   $1: source_file
#   $2: destination_file
function clone_timestamp() {
    local source_file="$1"
    local destination_file="$2"
    
    if [[ ! -f "$source_file" ]]; then
        echo "ERROR: Source file for timestamp clone does not exist: ${source_file}" >&2
        return 1
    fi

    touch -r "$source_file" "$destination_file"
} 