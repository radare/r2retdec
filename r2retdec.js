#!/usr/bin/env node

const r2pipe = require('r2pipe');
const r2 = r2pipe.lpipeSync();
const exec = require('child_process').execSync;
const highlight = require('cli-highlight').highlight;
const fs = require('fs');
const blessed = require('blessed');
const ArgumentParser = require('argparse').ArgumentParser;
const parser = new ArgumentParser({
      addHelp: true,
      description: 'r2retdec help'
});


// r2pipe.options = ['-N'];

function arg_help() {
      // argument parser
      parser.addArgument('-t', {
            help: 'Set temp file for decompiled code',
            defaultValue: '/tmp/r2.c',
            dest: 'tmp'
      });
      parser.addArgument('-v', {
            help: 'Open visual mode to navigate with r2retdec',
            dest: 'visual',
            action: 'storeTrue'
      });
      parser.addArgument('--python', {
            help: 'Print decompilation in python syntax. Default is C',
            dest: 'python',
            action: 'storeTrue'
      });
      return parser.parseArgs();
}

function checkConfig() {
      // Checks for and returns the path of the config file
      var configFile = process.env.HOME + '/.r2retdec';
      if (!fs.existsSync(configFile)) {
            console.log('\nCould not find config file. Set the path to retdec in $HOME/.r2retdec');
            process.exit(0);
      } else {
            return fs.readFileSync(configFile, 'utf8');
      }
}

function boxFrame(align, height, width, content) {
      var frame = blessed.box({
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                  bg: 'red'
            },
            vi: true,
            keys: true,
            mouse: true,
            top: align,
            draggable: true,
            left: 'center',
            width: width,
            height: height,
            content: content,
            tags: true,
            border: {
                  type: 'line'
            },
            style: {
                  fg: 'white',
                  border: {
                        fg: '#f0f0f0'
                  },
                  focus: {
                        border: {
                              bg: 'red'
                        }
                  }
            }
      });
      return frame;
}

function smallBoxes(command, key) {
      var info = screen.key([key], function () {
            var strings = boxFrame('left', '40%', '50%', command);
            strings.align = 'left';
            screen.append(strings);
            screen.key(['q'], function () {
                  strings.hide();
            });
            screen.render();
            strings.focus();
      });
}

function rename_functions(code) {
    fn_data = r2.cmdj('aflj');
    for (i = 0; i < fn_data.length; i++) {
        r2_name = fn_data[i].name;
        if(r2_name.slice(0,4) != "fcn.") {
            retdec_name = "function_" + fn_data[i].offset.toString(16);
            code = code.replace(new RegExp(retdec_name, 'g'), r2_name);
        }
    }
    return code
}

// runs retdec decompiler script
var binaryPath = r2.cmdj('oj')[0]['uri'];
// Check if we're using a ptrace uri (meaning we're in -d mode)
if (RegExp('^ptrace:\/\/[0-9]+$').test(binaryPath.trim())) {
    console.log('Decompilation does not work while in debug mode. Use pdc.');
    process.exit(0)
}
var pdf = r2.cmdj('pdfj');
if (pdf === null) {
	// Cannot find any function in current offset
	process.exit(0);
}
var functionStartAddress = '0x' + pdf.addr.toString(16);
var functionEndAddress = '0x' + pdf.ops.pop().offset.toString(16);
var retDecPath = checkConfig().replace('\n', '');
var a = arg_help();
var function_pdf = r2.cmd('pdf');

if (a.python === true) {
      var command = `${retDecPath} --cleanup -o ${a.tmp} -l py --select-ranges ${functionStartAddress}-${functionEndAddress} ${binaryPath}`;
} else {
      var command = `${retDecPath} --cleanup -o ${a.tmp} --select-ranges ${functionStartAddress}-${functionEndAddress} ${binaryPath}`;
}

try {
      var p = exec(command).toString();
      var code = fs.readFileSync(a.tmp, 'utf8');
      code = rename_functions(code);
      var highlighted_code = highlight(code);
} catch (e) {
      highlighted_code = 'Not valid for 64 bit arch. Using pdc instead\n\n';
      highlighted_code += highlight(r2.cmd('pdc'));
}

if (a.visual !== true) {
      console.log(highlighted_code);
      process.exit(0);
}

var screen = blessed.screen({
      smartCSR: true
});

screen.title = 'r2retdec';

var help = blessed.text({
      parent: screen,
      content: 'HELP: q (quit), h (help)',
      width: '90%',
      left: 'center',
      top: '98%'
});

screen.key(['tab'], function (ch, key) {
      screen.focusNext();
});

screen.key(['h'], function (ch, key) {
      var help = blessed.box({
            top: 'center',
            left: 'center',
            width: '25%',
            height: '40%',
            content: `HELP:
c: close help
d: show disassembly
s: function strings
c: function calls
q: quit r2retdec
TAB: choose box`,
            border: {
                  type: 'line',
                  fg: 'red'
            },
            parent: screen
      });
      screen.append(help);
      help.focus();
      screen.key(['q'], function (key, ch) {
            help.destroy();
      });
});
// show disassembly
screen.key(['d'], function () {
      var box1 = boxFrame('left', '100%', '75%', function_pdf);
      box1.align = 'left';
      screen.append(box1);
      box1.key(['q'], function () {
            box1.hide();
      });
      screen.render();
      box1.focus();
});
// show strings
smallBoxes(r2.cmd('pdsf~str'), 's');

// show calls
var calls = smallBoxes;
calls.height = '50%';
calls(r2.cmd('pdsf~call'), 'c');

// show xref
smallBoxes(r2.cmd('axt'), 'x');

var box2 = boxFrame('center', '99%', '100%', highlighted_code);
box2.focus();
screen.append(box2);
box2.key(['q'], function () {
      screen.destroy();
      r2.quit();
      process.exit(0);
});

screen.render();
