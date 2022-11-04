// Removes unnecessary block properties for new creation
exports.removeUnecessaryProperties = (obj) => {
    delete obj.id;
    delete obj.created_time;
    delete obj.last_edited_time;
    delete obj.created_by;
    delete obj.last_edited_by;
}
