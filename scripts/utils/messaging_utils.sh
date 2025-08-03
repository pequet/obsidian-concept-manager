#!/bin/bash

# Standard Error Handling
set -e
set -u
set -o pipefail

# Messaging Utilities
# Version: 1.1.1
# Author: Benjamin Pequet
# Projects: https://github.com/pequet/ 
# Purpose: Provides terminal messaging utility functions.

# Changelog:
# 1.1.1: Moved `prompt_user_input` to a new `input_utils.sh` as it's an input function.
# 1.1.0: Added a new function `prompt_user_input` to prompt the user for input with a default value.
# 1.0.0: Initial release.

# --- Guard against direct execution ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "This script provides utility functions and is not meant to be executed directly." >&2
    echo "Please source it from another DLS script." >&2
    exit 1
fi

# --- Function Definitions ---

# *
# * Messaging Functions
# *
# Handles all terminal/console output.
# Expects logging_utils.sh to be sourced first.

print_header() {
    local title="$1"
    echo "$title"
    echo "========================================================================"
    log_message "INFO" "--- Script Start: $title ---"
}

print_separator() {
    echo "========================================================================"
}

print_footer() {
    echo "========================================================================"
    log_message "INFO" "--- Script End ---"
}

print_step() {
    local message="$1"
    echo "- ${message}"
    log_message "STEP" "${message}"
}

print_completed() {
    local message="$1"
    echo "🏁 ${message}"
    log_message "COMPLETED" "${message}"
}

print_info() {
    local message="$1"
    echo "${message}"
    log_message "INFO" "${message}"
}

print_success() {
    local message="$1"
    echo "SUCCESS: ${message}"
    log_message "SUCCESS" "${message}"
}

print_warning() {
    local message="$1"
    echo "WARN: ${message}"
    log_message "WARN" "${message}"
}

print_error() {
    local message="$1"
    echo "ERROR: ${message}" >&2
    log_message "ERROR" "${message}"
}

print_error_details() {
    local command="$1"
    local output="$2"
    local details="Details: Command Failed: \`${command}\`"
    echo "    ${details}" >&2
    echo "    Output:" >&2
    echo "${output}" | awk '{print "      " $0}' >&2
    log_message "ERROR" "${details}"
    log_message "ERROR" "Output: ${output}"
}

# Formats a status line with an action, subject, and result.
# E.g., print_status_line "[COPYING]" "file.txt" "SUCCESS"
print_status_line() {
    local action="$1"
    local subject="$2"
    local result="$3"
    
    # Pad the subject to align the result column
    printf "%-14s %-45s ... %s\n" "${action}" "${subject}" "${result}"
    
    if [[ "${result}" != "SUCCESS" && "${result}" != *"SKIPPED"* ]]; then
        log_message "ERROR" "Action '${action}' on '${subject}' resulted in: ${result}"
    else
        log_message "INFO" "Action '${action}' on '${subject}' resulted in: ${result}"
    fi
} 