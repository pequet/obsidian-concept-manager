#!/bin/bash

# Standard Error Handling
set -e
set -u
set -o pipefail

# Input Utilities
# Version: 1.0.0
# Author: Benjamin Pequet
# Projects: https://github.com/pequet/ 
# Purpose: Provides user input collection utility functions.
# Refer to main project for detailed docs.

# --- Guard against direct execution ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "This script provides utility functions and is not meant to be executed directly." >&2
    echo "Please source it from another DLS script." >&2
    exit 1
fi

# --- Function Definitions ---

# *
# * Basic Input Functions
# *

# Prompts the user for a password securely without echoing input.
# Returns the password via stdout.
function get_password() {
    local prompt="$1"
    local password
    read -r -s -p "$prompt: " password
    echo >&2
    echo "$password"
}

# Prompts the user for a standard input.
# Arguments:
#   $1: prompt message
#   $2: (optional) "silent" - if provided, input will not echo to screen
# Returns the input via stdout.
function get_input() {
    local prompt="$1"
    local silent_mode="${2:-}"
    local input
    
    if [[ "$silent_mode" == "silent" ]]; then
        read -r -s -p "$prompt: " input
        echo >&2 # Print newline to stderr, not stdout
    else
        read -r -p "$prompt: " input
    fi
    
    echo "$input"
}

# Gets a single character input without requiring Enter
# Requires messaging_utils.sh to be sourced for print_info function
function get_single_char() {
    # This function does not accept arguments. The calling script must print the prompt.
    # It reads a full line of input from the user to ensure the "Enter" key is consumed,
    # then returns only the first character of that line.
    # This is the most robust method for this specific environment.
    local line
    read -r line
    echo "${line:0:1}"
}

# *
# * Input with Defaults
# *

# Gets a file path with a default option
# Arguments:
#   $1: default_path - the default file path to use
#   $2: prompt_message - the message to show the user
# Returns the chosen file path via stdout
# Requires messaging_utils.sh to be sourced for print_info function
function get_file_path_with_default() {
    local default_path="$1"
    local prompt_message="$2"
    
    print_info "Default file path: ${default_path}" >&2 # Redirect to stderr
    local custom_path
    custom_path=$(get_input "${prompt_message}")
    
    if [[ -z "$custom_path" ]]; then
        echo "$default_path"
    else
        echo "$custom_path"
    fi
}

# Prompts the user for input with a default value.
# The user's input is returned via stdout.
# The calling script is expected to have already displayed the default value.
# Usage:
#   user_response=$(prompt_user_input "Enter new value, or press Enter to accept default" "$default_value")
function prompt_user_input() {
    local prompt_message="$1"
    local default_value="$2"
    local user_input

    # We avoid `read -i` for better portability (e.g., on macOS default bash).
    # The -e flag enables readline for a better editing experience.
    read -e -p "${prompt_message}: " user_input
    
    # If user_input is empty (user just pressed Enter), return the original default_value.
    if [[ -z "$user_input" ]]; then
        echo "$default_value"
    else
        echo "$user_input"
    fi
}

# *
# * Validated Input
# *

# Prompts the user for a file path and validates its existence.
# Arguments:
#   $1: prompt message
#   $2: (optional) "silent" - if provided, input will not echo to screen
# Keeps prompting until a valid file path is entered.
# Returns the valid file path via stdout.
function get_valid_filepath() {
    local prompt="$1"
    local silent_mode="${2:-}"
    local filepath
    while true; do
        filepath=$(get_input "$prompt" "$silent_mode")
        
        # Strip leading/trailing single and double quotes from user input
        filepath="${filepath#\"}"
        filepath="${filepath%\"}"
        filepath="${filepath#\'}"
        filepath="${filepath%\'}"

        if [[ -f "$filepath" ]]; then
            echo "$filepath"
            return
        else
            if [[ "$silent_mode" == "silent" ]]; then
                echo "ERROR: File not found. Please try again." >&2
            else
                echo "ERROR: File not found at '${filepath}'. Please try again." >&2
            fi
        fi
    done
} 