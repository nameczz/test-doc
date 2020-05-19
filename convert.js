const merge = require("lodash/merge");
const fs = require("fs");
const path = require("path");
const ncp = require("ncp").ncp;
const name_fragment = "fragment";
const name_variable = "variables.json";
const name_doc_folder = "src";
const name_doc_target = "site";

const _getAbsPath = (father, child) => `${father}/${child}`;
const _getChildrenAbsPaths = path_abs => {
  return fs.readdirSync(path_abs).map(item => _getAbsPath(path_abs, item));
};
const _readFileToString = path_abs => fs.readFileSync(path_abs).toString();
const _isDirectory = path_abs => fs.lstatSync(path_abs).isDirectory();
const _splitDirectoryAndFile = paths_abs => {
  const directories = [];
  const markdowns = [];
  const jsons = [];
  paths_abs.forEach(path_abs => {
    if (_isDirectory(path_abs)) {
      directories.push(path_abs);
    } else if (path_abs.indexOf(".md") === path_abs.length - 3) {
      markdowns.push(path_abs);
    } else if (path_abs.indexOf(".json") === path_abs.length - 5) {
      jsons.push(path_abs);
    }
  });
  return { directories, markdowns, jsons };
};
const _replaceContent = (match, target = "", content) => {
  const len = match.length;
  const i = content.indexOf(match);
  const c_before = content.slice(0, i);
  const c_after = content.slice(i + len, content.length);
  return c_before + target + c_after;
};
const _replaceFragment = (content, map_fragment, language) => {
  const regex = /\{\{fragment\/.{0,1000}\}\}/gi;
  const matches = content.match(regex);
  // console.log(matches);
  if (matches) {
    // console.log(matches);
    matches.forEach(name_fragment => {
      const key = name_fragment
        .split(" ")
        .join("")
        .slice(2, name_fragment.length - 2);
      const path_abs = path.resolve(__dirname, name_doc_folder, language, key);
      const content_f = map_fragment[path_abs];
      // console.log(content);
      content = _replaceContent(name_fragment, content_f, content);
      // console.log(content);
    });
  }
  return content;
};
const _replaceVariable = (content, variable) => {
  const regex = /\{\{var\..{0,1000}\}\}/gi;
  const matches = content.match(regex);
  if (matches) {
    // console.log(matches);
    matches.forEach(name_fragment => {
      const keyChain = name_fragment
        .split(" ")
        .join("")
        .slice(2, name_fragment.length - 2)
        .split(".");
      keyChain.shift();
      let target = variable[keyChain[0]];
      let i = 1;
      while (i < keyChain.length) {
        target = target[key];
        i++;
      }
      content = _replaceContent(name_fragment, target, content);
      // console.log(content);
    });
  }
  return content;
};
const _reWriteFile = (path_abs, map_fragment, map_variable) => {
  let content = _readFileToString(path_abs);
  const language = path_abs
    .split(`${__dirname}/${name_doc_folder}/`)[1]
    .split("/")[0];
  content = _replaceFragment(content, map_fragment, language);
  content = _replaceVariable(content, map_variable);
  const path_target = path_abs.replace(name_doc_folder, name_doc_target);
  return fs.writeFileSync(path_target, content);
};
const _parseFragment = (path_abs, map_fragment = {}) => {
  const res = _getChildrenAbsPaths(path_abs) || [];
  const { directories, markdowns } = _splitDirectoryAndFile(res);
  if (markdowns.length) {
    markdowns.forEach(path_abs => {
      const content = fs.readFileSync(path_abs).toString();
      // console.log('xxx',content);
      map_fragment[path_abs] = content;
    });
  }
  if (directories.length) {
    directories.forEach(d => {
      map_fragment = _parseFragment(d, map_fragment);
    });
  }
  // console.log(JSON.stringify(map_fragment));
  return map_fragment;
};
const _parseVariable = (path_abs, map_variable = {}) => {
  const obj = JSON.parse(fs.readFileSync(path_abs).toString());
  // console.log({ ...map_variable, ...obj});
  return merge(map_variable, obj);
};

function convert(target, map_fragment = {}, map_variable = {}) {
  // 获取目录[fragment, variable, ....]
  const res = fs.readdirSync(target) || [];
  const targets = [];
  let fragmentFolder, variableFile;
  res.forEach(name => {
    const isContent = name !== name_fragment && name !== name_variable;
    if (isContent) {
      targets.push(_getAbsPath(target, name));
    }
    if (name === name_fragment) {
      fragmentFolder = name;
    }
    if (name === name_variable) {
      variableFile = name;
    }
  });
  // console.log(targets)
  const { directories, markdowns } = _splitDirectoryAndFile(targets);
  // console.log(directories, markdowns);
  // 获取fragment和顶部变量,开始遍历和替换
  if (!!fragmentFolder) {
    map_fragment = _parseFragment(
      _getAbsPath(target, fragmentFolder),
      map_fragment
    );
  }
  if (!!variableFile) {
    map_variable = _parseVariable(
      _getAbsPath(target, variableFile),
      map_variable
    );
  }
  // rewrite file
  markdowns.forEach(file => {
    _reWriteFile(file, map_fragment, map_variable);
  });
  // rewrite directories
  directories.forEach(directory => {
    convert(directory, map_fragment, map_variable);
  });
}

function convertAll(targets) {
  // console.log(`targets is : ${targets}`);
  targets.forEach(target => {
    convert(target);
  });
}

const main = (path_site, path_target) => {
  console.log(`Documents convention Start`);
  const res = fs.readdirSync(path_site) || [];
  const sites_next = res.map(item => _getAbsPath(path_site, item));
  if (sites_next.length) {
    ncp(path_site, path_target, function(err) {
      if (err) {
        return console.error(err);
      }
      convertAll(sites_next);
      console.log(`Documents convention Finished`);
    });
  } else {
    console.warn(`Documents is Empty`);
  }
};

main(
  path.resolve(__dirname, `${name_doc_folder}/`),
  path.resolve(__dirname, `${name_doc_target}/`)
);
