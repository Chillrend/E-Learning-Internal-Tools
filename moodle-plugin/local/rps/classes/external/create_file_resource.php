<?php
namespace local_rps\external;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/externallib.php');
require_once($CFG->dirroot . '/course/modlib.php');

use external_api;
use external_function_parameters;
use external_value;
use external_single_structure;
use context_course;

class create_file_resource extends external_api {

    public static function execute_parameters() {
        return new external_function_parameters([
            'courseid'    => new external_value(PARAM_INT, 'The course ID'),
            'name'        => new external_value(PARAM_TEXT, 'The activity name'),
            'draftitemid' => new external_value(PARAM_INT, 'The draft file itemid'),
            'section'     => new external_value(PARAM_INT, 'The section number (default 0)', VALUE_DEFAULT, 0),
        ]);
    }

    public static function execute($courseid, $name, $draftitemid, $section = 0) {
        global $DB;

        // Parameter validation
        $params = self::validate_parameters(self::execute_parameters(), [
            'courseid'    => $courseid,
            'name'        => $name,
            'draftitemid' => $draftitemid,
            'section'     => $section,
        ]);

        $context = context_course::instance($params['courseid']);
        self::validate_context($context);

        // Get resource module ID
        $module = $DB->get_record('modules', ['name' => 'resource'], '*', MUST_EXIST);

        // Fetch course record
        $course = $DB->get_record('course', ['id' => $params['courseid']], '*', MUST_EXIST);

        // Prepare moduleinfo object as expected by add_moduleinfo()
        $moduleinfo = new \stdClass();
        $moduleinfo->course         = $params['courseid'];
        $moduleinfo->module         = $module->id;
        $moduleinfo->modulename     = 'resource';
        $moduleinfo->section        = $params['section'];
        $moduleinfo->name           = $params['name'];
        $moduleinfo->intro          = '';
        $moduleinfo->introformat    = FORMAT_HTML;
        $moduleinfo->files          = $params['draftitemid'];
        $moduleinfo->display        = 0; // Automatic display
        $moduleinfo->showsize       = 0;
        $moduleinfo->showtype       = 0;
        $moduleinfo->showdate       = 0;
        $moduleinfo->visible        = 1;

        // Call Moodle's internal module creation logic
        $moduleinfo = add_moduleinfo($moduleinfo, $course);

        return [
            'cmid'       => (int) $moduleinfo->coursemodule,
            'resourceid' => (int) $moduleinfo->instance,
        ];
    }

    public static function execute_returns() {
        return new external_single_structure([
            'cmid'       => new external_value(PARAM_INT, 'Created course module ID'),
            'resourceid' => new external_value(PARAM_INT, 'Created resource instance ID'),
        ]);
    }
}
