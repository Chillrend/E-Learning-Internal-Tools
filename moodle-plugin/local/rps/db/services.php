<?php
defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_rps_create_file_resource' => [
        'classname'     => 'local_rps\external\create_file_resource',
        'methodname'    => 'execute',
        'description'   => 'Creates a file resource activity in a course section using a draft file itemid.',
        'type'          => 'write',
        'ajax'          => false,
        'services'      => [],
    ],
];
